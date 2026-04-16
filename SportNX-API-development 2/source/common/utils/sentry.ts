import * as Sentry from "@sentry/node";
import logger from "../config/logger";
import { StatusCodes } from "http-status-codes";
import { decrypt } from "../services/encryptDecrypt";
import { ErrorWithStatus, SentryErrorContext } from "./types";

export const sentryCaptureError = (
  error: ErrorWithStatus,
  context: SentryErrorContext = {}
) => {
  try {
    Sentry.withScope(async (scope) => {
      const statusCode = error.status || StatusCodes.INTERNAL_SERVER_ERROR;
      scope.setTag("http.status_code", String(statusCode));

      if (context.req) {
        let decryptedBody = context.req.body;

        // Only decrypt if the body is still encrypted (string)
        if (typeof context.req.body === "string") {
          try {
            decryptedBody = await decrypt(context.req.body);
          } catch (decryptError) {
            // If decryption fails, use the original body
            decryptedBody = context.req.body;
            logger.warn(
              "Failed to decrypt request body for Sentry:",
              decryptError
            );
          }
        }

        scope.setContext("request", {
          method: context.req.method,
          url: context.req.originalUrl,
          query: context.req.query,
          params: context.req.params,
          ip: context.req.ip,
          body: decryptedBody,
        });
        scope.setTag("url", context.req.originalUrl);
      }

      // Set extra context
      if (context.extra) {
        Object.entries(context.extra).forEach(([key, value]) => {
          if (value !== undefined) {
            scope.setExtra(key, value);
          }
        });
      }

      // Set tags if provided
      if (context.tags) {
        Object.entries(context.tags).forEach(([key, value]) => {
          if (value) {
            scope.setTag(key, String(value));
          }
        });
      }

      // Capture the error
      Sentry.captureException(error);
    });
  } catch (sentryError) {
    logger.error("Failed to capture error with Sentry:", sentryError);
    logger.error("Original error:", error);
  }
};
