import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import customerService from "./customerService";
import createResponse from "../../../common/utils/response";
import { handleError } from "../../../common/utils/appError";
// import { deleteUserQuery } from "../../../common/utils/types";
// import logger from "../../../common/config/logger";


const login = async (req: Request, res: Response) => {
  try {
    const response = await customerService.login(req.body, req);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.otpVerified"),
      response
    );
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const verifyOTP = async (req: Request, res: Response) => {
  try {
    const response = await customerService.verifyOTP(req.body, req);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.login"),
      response
    );
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const onboard = async (req: Request, res: Response) => {
  try {
    const response = await customerService.onboard(req.body, req);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.userOnborded"),
      response
    );
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const resendOTP = async (req: Request, res: Response) => {
  try {
    const response = await customerService.resendOTP(req.body, req);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.resenOTP"),
      response
    );
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const editUserProfile = async (req: Request, res: Response) => {
  try{
    const response = await customerService.editUserProfile(req.body, req);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.profileUpdated"),
      response
    );
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

// const deleteUser = async(req:Request, res:Response) => {
//   try {
//     const response = await customerService.deleteUser(req.query as unknown as deleteUserQuery, req);
//         createResponse(
//       res,
//       StatusCodes.OK,
//       req.t("successMessages.userDeleted"),
//       response
//     );
//   } catch (error:unknown) {
//     handleError(error, {
//       req,
//     });
//   }
// };

export default {
  login,
  verifyOTP,
  onboard,
  resendOTP,
  editUserProfile,
  // deleteUser
};
