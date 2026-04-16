import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

/**
 * It sends the status code 405 with error message 'Method Not Found'.
 * This error indicates that the requested resource exists but can not be acceesed with the requested method.
 */
const methodNotAllowed = (req: Request, res: Response): void => {
  res.status(StatusCodes.METHOD_NOT_ALLOWED).send({
    message: req.t("errorMessages.methodNotAllowed"),
  });
};

export default methodNotAllowed;
