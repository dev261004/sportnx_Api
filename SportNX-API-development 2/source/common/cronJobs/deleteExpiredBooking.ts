import * as cron from "node-cron";
import { Op } from "sequelize";
import logger from "../config/logger";
import Bookings from "../../database/models/bookings";


function startDeleteExpiredCron() {
  // Runs every minute
  const task = cron.schedule("* * * * *", async () => {
    try {
      const deleted = await Bookings.destroy({
        where: {
          paymentStatus: "pending",
          expiresAt: { [Op.lt]: new Date() } // or use createdAt < now - 5m
        }
      });
      if (deleted) logger.info(`[cron] Deleted ${deleted} expired bookings`);
    } catch (err) {
      logger.error("[cron] error deleting expired bookings", err);
    }
  });

  // start the task explicitly to ensure it is running
  task.start();

  // Graceful stop helper
  const stop = async () => {
    task.stop();
    logger.info("[cron] stopped");
  };

  return { task, stop };
}

export default startDeleteExpiredCron;