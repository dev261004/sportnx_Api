import { Request, Response } from "express";
import createResponse from "../../common/utils/response";
import { StatusCodes } from "http-status-codes";
import bookingService from "./bookingService";
import { ListSlotsQuery, ListSlotsUserQuery, userBookingList } from "../../common/utils/types";
import { handleError } from "../../common/utils/appError";
import logger from "../../common/config/logger";

const listAvailableSlots = async (req: Request, res: Response) => {
  try {
    const slots = await bookingService.listAvailableSlots(
      req.query as unknown as ListSlotsQuery,
      req
    );
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.availableSlot"),
      slots
    );
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const listBoxesForVenue = async (req: Request, res: Response) => {
  try {
    const { venueId } = req.query as { venueId: string };

    const boxes = await bookingService.listBoxesForVenue(venueId, req);

    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.boxesList"),
      boxes
    );
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

const createBooking = async (req: Request, res: Response) => {
  try {
    const data = req.body;

    await bookingService.createBooking(data, req);

    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.bookingCreated")
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    handleError(err, {
      req,
    });
  }
};

const getBookingList = async (req: Request, res: Response) => {
  try {
    const result = await bookingService.getBookingList(req);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.BookingListFetch"),
      result
    );
  } catch (err) {
    handleError(err, { req });
  }
};

const markAsPaid = async (req: Request, res: Response) => {
  try {
    const booking = await bookingService.markBookingAsPaid(req);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.markedPaid"),
      booking
    );
  } catch (err) {
    handleError(err, { req });
  }
};

const cancellationBooking = async (req: Request, res: Response) => {
  try {
    const booking = await bookingService.cancellationBooking(req);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.cancellation_booking"),
      booking
    );
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};
const listAvailableSlotsUser = async (req: Request, res: Response) => {
  try {
    const slots = await bookingService.listAvailableSlotsUser(
      req.query as unknown as ListSlotsUserQuery,
      req
    );
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.availableSlot"),
      slots
    );
  } catch (err) {
    handleError(err, { req });
  }
};

// const getUserBookingList = async (req: Request, res: Response) => {
//   try {
//     const result = await bookingService.getUserBookingList(req);
//     createResponse(
//       res,
//       StatusCodes.OK,
//       req.t("successMessages.BookingListFetch"),
//       result
//     );
//   // eslint-disable-next-line @typescript-eslint/no-explicit-any
//   } catch (err:any) {
//      logger.error("Error summary", {
//       name: err?.name,
//       message: err?.message,
//       stack: err?.stack?.split("\n")[0], // first line only
//       code: err?.code,
//       detail: err?.detail
//     });

//     // Let the error middleware produce the response
//     handleError(err, { req });
//   }
// };

const addUserBooking = async (req:Request, res:Response) => {
  try{
    const response = await bookingService.addUserBooking(req);
    logger.info("response",response);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.bookingCreated"),
      response
    );
  }
  catch(err:unknown){
    logger.info("error",err);
    handleError(err,{
      req,
    });
  }
};

const userBookingList = async (req:Request, res:Response) => {
  try {
    const response= await bookingService.userBookingList(req.query as unknown as userBookingList ,req);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessage.userBookingList"),
      response
    ); 
  } catch (error:unknown) {
    handleError(error,{
      req,
    });
  }
};

const deleteUserBooking = async (req:Request, res:Response) => {
  try {
    const response = await bookingService.deleteUserBooking(req);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.bookingDeleted"),
      response
    );
    
  } catch (error:unknown) {
    handleError(error,{
      req,
    });
  }
};

export default {
  listAvailableSlots,
  listBoxesForVenue,
  createBooking,
  getBookingList,
  markAsPaid,
  cancellationBooking,
  listAvailableSlotsUser,
  // getUserBookingList,
  userBookingList,
  addUserBooking,
  deleteUserBooking
};
