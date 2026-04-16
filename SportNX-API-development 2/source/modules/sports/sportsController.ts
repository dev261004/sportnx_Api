import { Request, Response } from "express";
import sportsService from "./sportsService";
import createResponse from "../../common/utils/response";
import { StatusCodes } from "http-status-codes";
import { handleError } from "../../common/utils/appError";

const setSports = async (req: Request, res: Response) => {
  try {
    await sportsService.setSports(req.body, req);
    createResponse(res, StatusCodes.OK, req.t("successMessages.setSports"));
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const getActiveSports = async (req: Request, res: Response) => {
  try {
    const response = await sportsService.getActiveSports(req);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.sports_fetched"),
      response
    );
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const setLocation = async (req: Request, res: Response) => {
  try {
    await sportsService.setLocation(req.body, req);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.locationUpdated")
    );
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

export default {
  setSports,
  getActiveSports,
  setLocation,
};
