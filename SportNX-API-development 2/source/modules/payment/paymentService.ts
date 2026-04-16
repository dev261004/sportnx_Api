import Razorpay from "razorpay";
import config from "../../common/config/config";
import Bookings from "../../database/models/bookings";
import logger from "../../common/config/logger";
import constant from "../../common/config/constant";
import CustomAppError from "../../common/utils/appError";
import { StatusCodes } from "http-status-codes";
import crypto from "crypto";
import { sequelize } from "../../database/sequelize";
import { Transaction } from "sequelize";


const razorpay = new Razorpay({
  key_id: config.razorpay.key_id as string,
  key_secret: config.razorpay.key_secret as string,
});

// export const createOrder = async (amount: number, currency = "INR",) => {
//   const options = {
//     amount: amount * 100,
//     currency,
//     receipt: `receipt_order_${Date.now()}`,
//     payment_capture: 1,
//   };
//   const oreder = await razorpay.orders.create(options);
//   logger.info("oreder:===>", oreder);
//   return oreder;
// };
export const createOrder = async (
  amount: number,
  currency = "INR",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra?: { notes?: Record<string, any> }
) => {
  try {
    const options = {
      amount: Math.round(amount * 100), //  convert to paise & ensure integer
      currency,
      receipt: `receipt_order_${Date.now()}`,
      payment_capture: 1,
      ...(extra ?? {}),
    };
    logger.info("options:===>", options);
    const order = await razorpay.orders.create(options);
    return order;
  } catch (error) {
    logger.info("error:===>", error);
  }
};

export const verifyPayment = async (
  order_id: string,
  payment_id: string,
  signature: string
) => {
  const generated_signature = crypto
    .createHmac("sha256", config.razorpay.key_secret as string)
    .update(order_id + "|" + payment_id)
    .digest("hex");
  logger.info(
    "generated_signature === signature:===>",
    generated_signature,
    signature,
    generated_signature === signature
  );
  return generated_signature === signature;
};

// export const refundPayment = async (payment_id: string, amount?: number) => {
//   return await razorpay.payments.refund(payment_id, {
//     amount: amount ? amount * 100 : undefined,
//   });
// };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handleWebhook = async (payload: any, signature: string) => {
  try {
    // Verify webhook signature
    logger.info("�� Processing webhook...",payload);
    const expectedSignature = crypto
      .createHmac("sha256", config.razorpay.key_secret as string)
      .update(JSON.stringify(payload))
      .digest("hex");

    logger.info("🔐 Signature verification:", expectedSignature === signature);

    if (expectedSignature !== signature) {
      throw new CustomAppError(
        StatusCodes.UNAUTHORIZED, 
        "Invalid webhook signature"
      );
    }

    const event = payload.event;
    logger.info(`Webhook event: ${event}`);
    switch (event) {
      case "payment.captured": {
        const payment = payload?.payload?.payment?.entity;
        if (!payment) throw new Error("Payment entity missing");

        logger.info("Payment captured", payment);
        await handlePaymentCaptured(payment);
        break;
      }

      case "payment.failed": {
        const payment = payload?.payload?.payment?.entity;
        if (!payment) throw new Error("Payment entity missing");

        await handlePaymentFailed(payment);
        break;
      }

      case "refund.processed": {
        const refund = payload?.payload?.refund?.entity;
        if (!refund) throw new Error("Refund entity missing");

        await handlePaymentRefunded(refund);
        break;
      }

      default:
        logger.warn(`Unhandled webhook event: ${event}`);
    }
    return { success: true };
  } catch (error: unknown) {
    logger.error(`Error handling webhook: ${error}`);
    throw error;
  }
};

// const handlePaymentCaptured = async (payment: any) => {
//   try {
//     logger.info(`Payment captured for booking: ${payment}`);

//     // const booking = await Bookings.findOne({
//     //   where: { razorpayPaymentId: payment.id },
//     // });

//     // if (!booking) {
//     //   logger.error(`Booking not found for payment: ${payment.id}`);
//     //   return;
//     // }

//     // const amount = payment.amount / 100;

//     // await booking.update({
//     //   paymentStatus: constant.PAYMENT_STATUS.FULL_PAID,
//     //   paidAmount: amount,
//     //   dueAmount: 0,
//     //   bookingStatus: constant.BOOKING_STATUS.CONFIRMED,
//     // });
//     // const slotsBook = await Bookings.create({
//     //   venueId:payment,
//     //   customerId: customerId || null,
//     //   ownerId: ownerId || null,
//     //   boxId,
//     //   sportId,
//     //   bookingDate: new Date(bookingDate),
//     //   startTime: slotGroup[0].startTime,
//     //   endTime: slotGroup[slotGroup.length - 1].endTime,
//     //   slotPrices: slotGroup,
//     //   bookingAmount,
//     //   convenienceFees,
//     //   totalAmount,
//     //   paidAmount,
//     //   dueAmount,
//     //   paymentStatus,
//     //   bookingStatus: constant.BOOKING_STATUS.CONFIRMED,
//     //   customerDetails,
//     //   razorpayPaymentId: "dummy",
//     //   razorpayPaymentMethod: "card",
//     // });

//     // logger.info("📌 Booking created successfully:", slotsBook);

//     logger.info(`Payment captured for booking: ${11111111}`);
//   } catch (error) {
//     logger.error(`Error handling payment captured: ${error}`);
//     throw error;
//   }
// };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handlePaymentCaptured = async (payment: any) => {
  const t = await sequelize.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ,
  });
  try {
    logger.info(`📌 Payment captured for Razorpay PaymentId: ${payment.id}`);
    const notes = payment.notes || {};
    const bookingId = notes.bookingId;

    if (!bookingId) {
      throw new CustomAppError(StatusCodes.BAD_REQUEST, "Missing bookingId in payment notes");
    }

    // Lock the booking row so concurrent handlers can't race.
    const booking = await Bookings.findOne({
      where: { id: bookingId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!booking) {
      // Prefer throwing — creating here may be the root cause of duplicates.
      throw new CustomAppError(StatusCodes.NOT_FOUND, `No booking found for id ${bookingId}`);
    }

    // Idempotency: if the payment id is already attached, skip.
    if (booking.razorpayPaymentId && booking.razorpayPaymentId === payment.id) {
      logger.info(`Booking ${bookingId} already processed for payment ${payment.id}. Skipping.`);
      await t.commit();
      return booking;
    }

    // If a different payment is already recorded, log and decide the policy.
    if (booking.razorpayPaymentId && booking.razorpayPaymentId !== payment.id) {
      logger.warn(`⚠️ Booking ${bookingId} already linked to payment ${booking.razorpayPaymentId}. New payment ${payment.id}`);
      // optional: notify ops / choose to overwrite or not
    }

    // Parse fields from notes safely
    const bookingAmount = notes.bookingAmount ? JSON.parse(notes.bookingAmount) : {};
    const convenienceFees = notes.convenienceFees ? JSON.parse(notes.convenienceFees) : {};
    const totalAmount = parseFloat(notes.totalAmount || "0");
    const paidAmount = parseFloat(notes.paidAmount || "0");
    const dueAmount = parseFloat(notes.dueAmount || "0");
    const paymentStatus = notes.paymentStatus || constant.PAYMENT_STATUS.FULL_PAID;
    const customerDetails = notes.customerDetails ? JSON.parse(notes.customerDetails) : {};

    // Apply updates on the instance and save
    booking.customerId = booking.customerId === null?  notes.customerId : booking.customerId ;
    booking.bookingAmount = bookingAmount;
    booking.convenienceFees = convenienceFees;
    booking.totalAmount = totalAmount;
    booking.paidAmount = paidAmount;
    booking.dueAmount = dueAmount;
    booking.paymentStatus = paymentStatus;
    booking.bookingStatus = constant.BOOKING_STATUS.CONFIRMED;
    booking.customerDetails = customerDetails;
    booking.razorpayPaymentId = payment.id;
    booking.razorpayPaymentMethod = payment.method;

    await booking.save({transaction: t });

    await t.commit();
    return booking;

  } catch (error) {
    await t.rollback(); 
    logger.error(`❌ Error handling payment captured: ${error}`);
    throw error;
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handlePaymentFailed = async (payment: any) => {
  try {
    const booking = await Bookings.findOne({
      where: { razorpayPaymentId: payment.id },
    });

    if (!booking) {
      logger.error(`Booking not found for payment: ${payment.id}`);
      return;
    }

    await booking.update({
      // paymentStatus: constant.PAYMENT_STATUS.FAILED,
      bookingStatus: constant.BOOKING_STATUS.CANCELLED,
    });

    logger.info(`Payment failed for booking: ${booking.id}`);
  } catch (error) {
    logger.error(`Error handling payment failed: ${error}`);
    throw error;
  }
};

export const initiateRefund = async ({
  bookingId,
  razorpayPaymentId,
  refundAmount,
}: {
  bookingId:string;
  razorpayPaymentId: string;
  refundAmount?: number;
}) => {
 try {

   let refund;

   const booking = await Bookings.findByPk(bookingId, {
           attributes: ["id"],
   });
 
     if (!booking) {
       logger.error(`Booking not found for payment: ${razorpayPaymentId}`);
       return;
     }
 
   if (typeof refundAmount === "number" && refundAmount > 0) {
    logger.info("Initiating refund of amount:", Math.round(refundAmount * 100));
     refund = await razorpay.payments.refund(razorpayPaymentId, {
       amount: Math.round(refundAmount * 100),
     });

   } else {
        const cancellationDetails = {
      cancellationTimeStamp: new Date(),
    };
     await booking.update(
      {
        bookingStatus: constant.BOOKING_STATUS.CANCELLED,
        refundAmount,
        cancellationDetails
      });

    return {
      status: "SUCCESS",
      refundProcessed: false,
      refundAmount: 0,
      message: "Booking cancelled. No refund applicable as per cancellation policy.",
    };
  }
     return {
     refundId: refund.id,
     status: refund.status,
     amount: refund.amount ? refund.amount / 100 : 0,
   };

 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 } catch (error:any) {
  logger.error("Razorpay refund failed", {
      message: error?.message,
      statusCode: error?.statusCode,
      
      razorpayError: error?.error,
    });
    throw error;
 }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handlePaymentRefunded = async (refund: any) => {
  try {

    const booking = await Bookings.findOne({
      where: { razorpayPaymentId: refund.payment_id },
    });

    if (!booking) {
      logger.error(
        `Booking not found for paymentId: ${refund.payment_id}`
      );
      return;
    }

    const refundedAmount = refund.amount / 100; // paise → INR
    const totalRefunded =
      (booking.refundAmount || 0) + refundedAmount;

    const cancellationDetails = {
      cancellationTimeStamp: new Date(),
    };

    await booking.update({
      refundAmount: totalRefunded,
      bookingStatus: constant.BOOKING_STATUS.CANCELLED,
      cancellationDetails,
      paymentStatus: constant.PAYMENT_STATUS.REFUNDED,
    });
  } catch (error) {
    logger.error(`Error handling refund webhook: ${error}`);
    throw error;
  }
};

