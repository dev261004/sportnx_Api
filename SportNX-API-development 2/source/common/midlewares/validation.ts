import { Request, Response, NextFunction, RequestHandler } from "express";
import joi, { ValidationResult } from "joi";
import { pick } from "lodash";
import { RequestSchema } from "../utils/types";
// import logger from "../config/logger";
import { StatusCodes } from "http-status-codes";

const validation = (schema: RequestSchema): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // logger.info("Request body from validation function:", req.body);

    const validSchema = pick(schema, ["params", "query", "body"]);
    const object = pick(req, Object.keys(validSchema));

    const { value, error }: ValidationResult = joi
      .compile(validSchema)
      .prefs({ errors: { label: "key" }, abortEarly: false })
      .validate(object);

    if (error) {
      const requiredErrors: Record<string, string> = {};
      const validationErrors: Record<string, string> = {};

      error.details.forEach((i) => {
        const label = i.context?.label || i.context?.key || i.path[0];
        const type = i.type;
        if (type === "any.required" || type === "string.empty") {
          requiredErrors[label] =
            req.t(`requiredField.${label}`) || `${label} is required`;
          return;
        }

        const translationKey = `validationErrorMessages.${label}.${type}`;
        let translatedMessage = req.t(translationKey);
        if (!translatedMessage || translatedMessage === translationKey) {
          translatedMessage =
            req.t(`validationErrorMessages.${label}`) || i.message;
        }

        validationErrors[label] = translatedMessage;
      });

      if (Object.keys(requiredErrors).length > 0) {
        res.status(StatusCodes.BAD_REQUEST).json({
          message: req.t("errorMessages.requiredFields"),
          data: requiredErrors,
        });
        return;
      }

      if (Object.keys(validationErrors).length > 0) {
        res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
          message: req.t("errorMessages.validationFailed"),
          data: validationErrors,
        });
        return;
      }

      res.status(StatusCodes.BAD_REQUEST).json({
        message: req.t("errorMessages.validationFailed"),
        data: { error: req.t("errorMessages.unknownValidationError") },
      });

      return;
    }

    if (value.query) Object.assign(req.query, value.query);
    if (value.body) Object.assign(req.body, value.body);
    if (value.params) Object.assign(req.params, value.params);
    next();
  };
};

export default validation;
