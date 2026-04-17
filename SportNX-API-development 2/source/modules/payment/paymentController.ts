import { Request, Response } from "express";
import {
  completeBypassBooking,
  createOrder,
  handleWebhook,
  initiateRefund,
  verifyPayment,
} from "./paymentService";
import createResponse from "../../common/utils/response";
import { StatusCodes } from "http-status-codes";
import { handleError } from "../../common/utils/appError";
import logger from "../../common/config/logger";


export const createOrderController = async (req: Request, res: Response) => {
  try {
    const { amount, currency, bookingData } = req.body;

    if (bookingData?.skipPaymentGateway) {
      const booking = await completeBypassBooking(bookingData);

      createResponse(
        res,
        StatusCodes.OK,
        req.t("successMessages.orderCreated"),
        booking
      );
      return;
    }

    const notes = {
      venueId: bookingData.venueId,
      boxId: bookingData.boxId,
      customerId: bookingData.customerId,
      sportId: bookingData.sportId,
      bookingDate: bookingData.bookingDate,
      slots: JSON.stringify(bookingData.slots),
      bookingAmount: JSON.stringify(bookingData.bookingAmount),
      bookingId: bookingData.bookingId,
      convenienceFees: JSON.stringify(bookingData.convenienceFees),
      totalAmount: bookingData.totalAmount.toString(),
      paidAmount: bookingData.paidAmount.toString(),
      dueAmount: bookingData.dueAmount.toString(),
      paymentStatus: bookingData.paymentStatus,
      customerDetails: JSON.stringify(bookingData.customerDetails),
    };
    const order = await createOrder(amount, currency, {notes});
    logger.info("order:===>", order);
    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.orderCreated"),
      order
    );
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

export const verifyPaymentController = async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;
    logger.info("req.body:===>", req.body);
    const isValid = await verifyPayment(
      razorpay_order_id || req.body.order_id,
      razorpay_payment_id || req.body.payment_id,
      razorpay_signature || req.body.signature
    );

    if (isValid) {
      createResponse(
        res,
        StatusCodes.OK,
        req.t("successMessages.paymentVerified")
      );
    } else {
      createResponse(
        res,
        StatusCodes.BAD_REQUEST,
        req.t("errorMessages.invalidSignature")
      );
    }
  } catch (err: unknown) {
    handleError(err, {
      req,
    });
  }
};

export const refundPaymentController = async (
  req: Request,
  res: Response
) => {
  try {
    const { bookingId, refundAmount, razorpayPaymentId } = req.body;

    if (!bookingId) {
      createResponse(
        res,
        StatusCodes.BAD_REQUEST,
        "bookingId is required"
      );
      return;
    }

    const refund = await initiateRefund({
      bookingId,
      razorpayPaymentId,
      refundAmount
    });

    if(refund){

      createResponse(
        res,
        StatusCodes.OK,
        req.t("successMessages.refundInitiated"),
        refund
      );
    }
    
  } catch (err: unknown) {
    handleError(err, { req });
  }
};

export const webhookController = async (req: Request, res: Response) => {
  try {
    logger.info("🔔 Webhook received!");
    // logger.info("Headers:", req.headers);
    // logger.info("Body:", req.body);

    const signature = req.headers["x-razorpay-signature"] as string;

    if (!signature) {
      logger.info("❌ No signature found");
      createResponse(
        res,
        StatusCodes.BAD_REQUEST,
        req.t("errorMessages.missingSignature")
      );
      return;
    }

    // Raw body ko string mein convert karo if needed
    const body = req.body instanceof Buffer ? req.body.toString() : req.body;
    const payload = typeof body === "string" ? JSON.parse(body) : body;

    logger.info("📦 Payload:", JSON.stringify(payload, null, 2));

    await handleWebhook(payload, signature);
    logger.info("✅ Webhook processed successfully");

    createResponse(
      res,
      StatusCodes.OK,
      req.t("successMessages.webhookProcessed")
    );
  } catch (err: unknown) {
    logger.info("❌ Webhook error:", err);
    handleError(err, {
      req,
    });
  }
};
