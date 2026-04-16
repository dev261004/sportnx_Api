import http from "http";
import express, { Request, Response, Express, NextFunction } from "express";
import cors from "cors";
import i18nextMiddleware from "i18next-http-middleware";
import i18next from "./common/midlewares/i18next";
import { StatusCodes } from "http-status-codes";
import CustomAppError from "./common/utils/appError";
import routes from "./routes";
import logger from "./common/config/logger";
import config from "./common/config/config";
import { sequelize } from "./database/sequelize";
import * as Sentry from "@sentry/node";
import constant from "./common/config/constant";
import createResponse from "./common/utils/response";
import { webhookController } from "./modules/payment/paymentController";
import startDeleteExpiredCron from "./common/cronJobs/deleteExpiredBooking";
// import ngrok from "@ngrok/ngrok"

const   app: Express = express();

app.disable("x-powered-by");

if (config.env === constant.ENV.LIVE || config.env === constant.ENV.STAGING) {
  Sentry.init({
    dsn: config.sentry.sentrydns,
    sendDefaultPii: true,
  });
}


app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  webhookController
);

const { task } = startDeleteExpiredCron();

app.use(cors());
app.use(i18nextMiddleware.handle(i18next));
app.use(express.urlencoded({ extended: false }));

// app.use(express.json());
app.use(express.json({ limit: "50mb" })); // or higher if needed
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use((req: Request, res: Response, next: NextFunction) => {
  res.removeHeader("Server");
  next();
});

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self';"
  );
  next();
});

app.use((req: Request, res: Response, next: NextFunction) => {
  Sentry.setContext("request", {
    method: req.method,
    url: req.originalUrl,
    query: req.query,
    params: req.params,
    ip: req.ip,
    body: req.body,
  });
  next();
});

app.use("/", routes);

app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to SportNX API");
});

app.use((req: Request, res: Response) => {
  const error = new Error("Endpoint not found.");
  res.status(404).json({
    message: error.message,
  });
});

Sentry.setupExpressErrorHandler(app);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (!res.headersSent) {
    if (err instanceof CustomAppError) {
      createResponse(res, err.status, err.message);
    } else if (err.name === "MulterError") {
      createResponse(res, StatusCodes.BAD_REQUEST, err.message);
    } else {
      createResponse(
        res,
        StatusCodes.INTERNAL_SERVER_ERROR,
        req.t("errorMessages.internalServerError")
      );
    }
  } else {
    next(err);
  }
});

const unexpectedErrorHandler = (error: Error) => {
  //Logs an error message to the console and calls the exitHandler function.
  logger.error(error);
  exitHandler();
};

// Registers an error handler for uncaught exceptions and unhandled rejections.
process.on("uncaughtException", unexpectedErrorHandler);
process.on("unhandledRejection", unexpectedErrorHandler);

const httpServer = http.createServer(app);

const exitHandler = async () => {
  logger.info("Shutting down the server...");
  try {
    await sequelize.close();
    logger.info("Database connection closed.");
  } catch (error) {
    logger.error("Error while closing the database connection:", error);
  }
  if (httpServer) {
    httpServer.close(() => {
      logger.info("Server closed gracefully.");
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

httpServer.listen(config.port || 4000, () => {
  logger.info(`Server is running on port ${config.port || 4000}`);
});



process.on("SIGINT", async () => {
  logger.info("SIGINT, shutting down cron");
  task.stop();

  process.exit(0);
});


process.on("SIGTERM", () => {
  logger.info("Received SIGTERM signal.");
  exitHandler();
});


sequelize
  .authenticate()
  .then(async () => {
    logger.info(
      "Connection to the database has been established successfully."
    );
  })
  .catch((error) => {
    logger.error("Failed to authenticate with the database:", error);
    process.exit(1);
  });
