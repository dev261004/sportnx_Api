import { Request, Response } from "express";
import createResponse from "../../../common/utils/response";
import commonService from "./commonService";
import { StatusCodes } from "http-status-codes";
import { handleError } from "../../../common/utils/appError";

const refreshToken = async (req: Request, res: Response) => {
  try {
    const response = await commonService.refreshToken(req.body, req);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.refreshToken"),
      response
    );
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const logout = async (req: Request, res: Response) => {
  try {
    await commonService.logout(req.body, req);
    createResponse(res, StatusCodes.OK, req.t("successMessages.logout"));
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const imageUpload = async (req: Request, res: Response) => {
  try {
    const imageURl = await commonService.imageUpload(req);

    res.status(StatusCodes.OK).json({
      message: req.t("successMessages.ImageUpload"),
      data: imageURl,
    });
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const imageDelete = async (req: Request, res: Response) => {
  try {
    const imageURl = await commonService.imageDelete(req);
    res.status(StatusCodes.OK).json({
      message: req.t("successMessages.ImageDeleted"),
      data: imageURl,
    });
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

export default {
  refreshToken,
  logout,
  imageUpload,
  imageDelete,
};
