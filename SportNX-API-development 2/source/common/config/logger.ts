import config from "./config";
import winston from "winston";
import constant from "./constant";

const customLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const customColors = {
  error: "red",
  warn: "yellow",
  info: "green",
  debug: "blue",
};

winston.addColors(customColors);

// 2. Check if environment is production
const isProduction = config.env === constant.ENV.LIVE;

// 3. Create the logger with conditional transports
const logger = winston.createLogger({
  levels: customLevels,
  level: isProduction ? "error" : "debug", // Disable in production
  format: winston.format.combine(
    winston.format.colorize({ all: !isProduction }),
    winston.format.printf(({ level, message, ...meta }) => {
      const splat = meta[Symbol.for("splat") as symbol] as unknown[];
      const prettyExtra = Array.isArray(splat)
        ? splat
            .map((item) =>
              typeof item === "object"
                ? `\n${JSON.stringify(item, null, 2)}` // pretty-print with 2-space indent
                : item
            )
            .join("\n")
        : "";

      return `${level}: ${message} ${prettyExtra}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    ...(isProduction
      ? [
          new winston.transports.File({
            filename: "error.log",
            level: "error",
          }),
        ]
      : []),
  ],
});

export default logger;
