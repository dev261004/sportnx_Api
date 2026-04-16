import { Sequelize, Model } from "sequelize";
import { join } from "path";
import { readdirSync } from "fs";
import config from "../common/config/config";
import logger from "../common/config/logger";

const databaseUrl = config.sequlize.url;

const shouldUseSsl = (() => {
  try {
    const { hostname } = new URL(databaseUrl);
    return !["localhost", "127.0.0.1"].includes(hostname);
  } catch {
    return config.env !== "development";
  }
})();

const sequelize = new Sequelize(databaseUrl, {
  dialect: "postgres",
  logging: true,
  ...(shouldUseSsl
    ? {
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        },
      }
    : {}),
});

const models: Record<string, typeof Model> = {};
const modelsDirectory = join(__dirname, "models");

readdirSync(modelsDirectory).forEach(async (file) => {
  if (file.endsWith(".ts") && file !== "index.ts") {
    const { default: model } = await import(join(modelsDirectory, file));
    if (model?.name) {
      models[model.name] = model;
    } else {
      logger.debug(
        `Model in file ${file} does not have a valid export or name.`
      );
    }
  }
});

export { sequelize };
