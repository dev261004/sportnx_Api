import { Request, Response, NextFunction } from "express";
import { decrypt } from "../services/encryptDecrypt";
import constant from "../config/constant";
import { handleError } from "../utils/appError";

const decryptRequestBody = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const decryptedData: unknown = await decrypt(req.body.data);
    req.body = decryptedData;
    next();
  } catch (error: unknown) {
    handleError(error, {
      req,
      priority: constant.PRIORITY.LOW,
    });
  }
};

export default decryptRequestBody;
