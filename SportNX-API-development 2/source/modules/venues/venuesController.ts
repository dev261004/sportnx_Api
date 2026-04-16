import { Request, Response } from "express";
import createResponse from "../../common/utils/response";
import { StatusCodes } from "http-status-codes";
import venuesService from "./venuesService";
import {
  FindVenuesQuery,
  venueDetailQuery,
  VenuesListQuery,
} from "../../common/utils/types";
import { handleError } from "../../common/utils/appError";
import logger from "../../common/config/logger";


const getCityList = async (req: Request, res: Response) => {
  try {
    const response = await venuesService.getCityList(req);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.cityList"),
      response
    );
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const venuesList = async (req: Request, res: Response) => {
  try {
    const response = await venuesService.venuesList(
      req.query as unknown as VenuesListQuery,
      req
    );
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.venuesList"),
      response
    );
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const venuesHomepageList = async (req: Request, res: Response) => {
  try {
    const response = await venuesService.venuesHomepageList(req.query, req);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.venuesHomepageList"),
      response
    );
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const fixedPrice = async (req: Request, res: Response) => {
  try {
    await venuesService.fixedPrice(req.body, req);
    createResponse(res, StatusCodes.OK, req.t("successMessages.fixedPrice"));
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const addVenueTiming = async (req: Request, res: Response) => {
  try {
    const response = await venuesService.addVenueTiming(req);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.venueTimingAdd"),
      response
    );
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const updateSlotPrices = async (req: Request, res: Response) => {
  try {
    await venuesService.updateTimeSlotPrices(req);

    createResponse(res, StatusCodes.OK, req.t("successMessages.fixedPrice"));
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const findVenues = async (req: Request, res: Response) => {
  try {
    const response = await venuesService.findVenues(
      req.query as unknown as FindVenuesQuery,
      req
    );
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.findVenues"),
      response
    );
  } catch (err: unknown) {
    handleError(err, { req });
  }
};

const venueDetail = async (req: Request, res: Response) => {
  try {
    const response = await venuesService.venueDetail(
      req.query as unknown as venueDetailQuery,
      req
    );
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.venueDetail"),
      response
    );
  } catch (err: unknown) {
    handleError(err, { req });
    throw err;
  }
};

const getVenueDetail = async (req: Request, res: Response) => {
  try {
    const data = await venuesService.getVenueDetail(req);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.venueDetail"),
      data
    );
  } catch (err) {
    handleError(err, { req });
  }
};

const getBoxDetail = async (req: Request, res: Response) => {
  try {
    const data = await venuesService.getBoxDetail(req);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.boxDetail"),
      data
    );
  } catch (err) {
    handleError(err, { req });
  }
};

const getVenueImages = async (req: Request, res: Response) => {
  try {
    const data = await venuesService.getVenueImages(req);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.venueImages"),
      data
    );
  } catch (err) {
    handleError(err, { req });
  }
};

const gerVenuesListBySearch = async (req: Request, res: Response) => {
  try {
    const response = await venuesService.gerVenuesListBySearch(
      req.query as unknown as VenuesListQuery,
      req
    );
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.venuesList"),
      response
    );
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const getOwnerVenueList = async (req: Request, res: Response) => {
  try {
    const response = await venuesService.getOwnerVenueList(req);
    logger.info("Owner Venue List Response:", response);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.ownerVenueList"),
      response?.venueDetails
    );
  }
    catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

export default {
  getCityList,
  venuesList,
  venuesHomepageList,
  fixedPrice,
  addVenueTiming,
  updateSlotPrices,
  findVenues,
  venueDetail,
  getVenueDetail,
  getBoxDetail,
  getVenueImages,
  gerVenuesListBySearch,
  getOwnerVenueList
};
