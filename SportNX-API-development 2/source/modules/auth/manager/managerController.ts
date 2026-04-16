import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import managerService from "./managerService";
import createResponse from "../../../common/utils/response";
import constant from "../../../common/config/constant";
import { handleError } from "../../../common/utils/appError";

const setPassword = async (req: Request, res: Response) => {
  try {
    await managerService.setPassword(req.body, req);
    createResponse(res, StatusCodes.OK, req.t("successMessages.passwordSet"));
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const login = async (req: Request, res: Response) => {
  try {
    const response = await managerService.login(req.body, req);
    createResponse(res, StatusCodes.OK, "Login successful.", response);
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const forgotPassword = async (req: Request, res: Response) => {
  try {
    const response = await managerService.forgotPassword(
      req.body,
      req,
      constant.END_POINT.FORGOTPASSWORD
    );
    if (req.body.phone) {
      createResponse(
        res,
        StatusCodes.OK,
        req.t("successMessages.forgotPasswordPhone"),
        response
      );
    } else {
      createResponse(
        res,
        StatusCodes.OK,
        req.t("successMessages.forgotPasswordEmail"),
        response
      );
    }
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const verifyOTP = async (req: Request, res: Response) => {
  try {
    await managerService.verifyOTP(req.body, req);
    createResponse(res, StatusCodes.OK, req.t("successMessages.verifyOTP"));
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const resendOTP = async (req: Request, res: Response) => {
  try {
    // const response = await managerService.resendOTP(req.body, req);
    const response = await managerService.forgotPassword(
      req.body,
      req,
      constant.END_POINT.RESENDOTP
    );
    if (req.body.phone) {
      createResponse(
        res,
        StatusCodes.OK,
        req.t("successMessages.resendOTPPhone"),
        response
      );
    } else {
      createResponse(
        res,
        StatusCodes.OK,
        req.t("successMessages.resendOTPEmail"),
        response
      );
    }
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const resetPassword = async (req: Request, res: Response) => {
  try {
    await managerService.resetPassword(req.body, req);
    createResponse(res, StatusCodes.OK, req.t("successMessages.resetPassword"));
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const changePassword = async (req: Request, res: Response) => {
  try {
    await managerService.changePassword(req.body, req);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.passwordChanged")
    );
  } catch (err: unknown) {
    handleError(err, { req });
  }
};

const checkPassword = async (req: Request, res: Response) => {
  try {
    const result = await managerService.checkPassword(req);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.isHavePassword"),
      result
    );
  } catch (err: unknown) {
    handleError(err, { req });
  }
};
export default {
  setPassword,
  login,
  forgotPassword,
  verifyOTP,
  resendOTP,
  resetPassword,
  changePassword,
  checkPassword,
};
