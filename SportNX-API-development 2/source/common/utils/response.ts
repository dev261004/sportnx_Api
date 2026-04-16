import { Response } from "express";
import { ApiResponse, ResponseData } from "./types";
import { encrypt } from "../services/encryptDecrypt";
import logger from "../config/logger";

const createResponse = async (
  res: Response,
  status: number = 500,
  message: string = "internal server error",
  payload?: Array<object> | object | string | null,
  title?: string
): Promise<Response<ApiResponse>> => {
  const response: ResponseData = {};
  if (title) {
    response.title = title;
  }
  if (message) {
    response.message = message;
  }
  if (payload) {
    try {
      payload = encodeURI(JSON.stringify(payload));
      response.data = await encrypt(payload);
    } catch (error: unknown) {
      logger.error("error", error);
    }
  }
  return res.status(status).json(response);
};

export default createResponse;
