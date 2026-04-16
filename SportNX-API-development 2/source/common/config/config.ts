import dotenv from "dotenv";
import path from "path";
import joi, { ObjectSchema } from "@hapi/joi";
import { EnvironmentVariables } from "../utils/types";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

const envVarsSchema: ObjectSchema<EnvironmentVariables> = joi
  .object()
  .keys({
    NODE_ENV: joi.string().valid("development", "staging", "live").required(),
    PORT: joi.number().default(3000),
    DATABASE_URL: joi.string().required().description("Sequelize DB url"),
    ENCRYPTION_KEY: joi.string(),
    ENCRYPTION_IV: joi.string(),
    DB_ENCRYPTION_KEY: joi.string(),
    WEB_URL: joi.string(),
    GMAIL_USER: joi.string().required(),
    GMAIL_PASSWORD: joi.string().required(),
    EMAIL_OWNER: joi.string().required(),
    RAZORPAY_KEY_ID: joi.string().required(),
    RAZORPAY_KEY_SECRET: joi.string().required(),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema
  .prefs({ errors: { label: "key" } })
  .validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export default {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  sequlize: {
    url: envVars.DATABASE_URL,
  },
  encryption: {
    key: envVars.ENCRYPTION_KEY,
    iv: envVars.ENCRYPTION_IV,
    dbEncryptionKey: envVars.DB_ENCRYPTION_KEY,
  },
  webUrl: envVars.WEB_URL,
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationDays: envVars.JWT_ACCESS_EXPIRATION_DAYS,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
  },
  sentry: {
    sentrydns: envVars.SENTRY_DNS,
  },

  email: {
    gmailUser: envVars.GMAIL_USER,
    gmailPassword: envVars.GMAIL_PASSWORD,
    emailOwner: envVars.EMAIL_OWNER,
  },
  region: envVars.REGION,
  wasabisys: envVars.WASABISYS,
  wasabisysPrefixUrl: envVars.WASABISYS_PREFIX_URL,
  razorpay: {
    key_id: envVars.RAZORPAY_KEY_ID,
    key_secret: envVars.RAZORPAY_KEY_SECRET,
  },
};
