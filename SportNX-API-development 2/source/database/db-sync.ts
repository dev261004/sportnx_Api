import logger from "../common/config/logger";
import { sequelize } from "./sequelize";
import * as Sentry from "@sentry/node";

const syncDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info("Database connection has been established successfully.");
    await sequelize.sync({ alter: true });
    logger.info("Database synced successfully.");
  } catch (error) {
    logger.error("Error syncing database:", error);
    Sentry.captureException(error);
    throw error;
  }
};

syncDatabase();
