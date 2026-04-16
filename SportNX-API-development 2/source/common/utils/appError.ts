import { StatusCodes } from "http-status-codes";
import logger from "../config/logger";
import { sentryCaptureError } from "./sentry";
import { AppError, ErrorHandlerOptions, ErrorWithStatus } from "./types";

class CustomAppError extends Error implements AppError {
  status: number;
  isOperational: boolean;
  title?: string;

  constructor(
    statusCode: number,
    message: string,
    isOperational = true,
    stack = "",
    title?: string
  ) {
    super(message);

    this.status = statusCode;
    this.isOperational = isOperational;
    this.title = title;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export const handleError = (
  error: unknown,
  options: ErrorHandlerOptions
): never => {
  const { req, version, priority } = options;

  // Send to Sentry
  if (priority) {
    sentryCaptureError(error as ErrorWithStatus, {
      req,
      tags: { priority, version: version || "unknown" },
    });
  }

  // Extract status and message
  let status = StatusCodes.INTERNAL_SERVER_ERROR;
  let message = "Internal Server Error";

  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    "message" in error
  ) {

    logger.info(`Error in ${req.originalUrl}:`, {
      status: (error as { status?: number }).status,
      message: (error as { message?: string }).message,
    });

    status =
      (error as { status?: number }).status ||
      StatusCodes.INTERNAL_SERVER_ERROR;
    message =
      (error as { message?: string }).message || "Internal Server Error";
  }

  throw new CustomAppError(status, message);
};

export default CustomAppError;
