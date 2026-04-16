import joi from "joi";
import { RequestSchema } from "../../common/utils/types";
import { validateIndianPhone } from "../../common/utils/helper";
import constant from "../../common/config/constant";

const listSlotsValidation: RequestSchema = {
  query: joi.object().keys({
    venueId: joi.string().uuid().required(),
    boxId: joi.string().uuid().required(),
  }),
};

const listBoxesValidation: RequestSchema = {
  query: joi.object().keys({
    venueId: joi.string().uuid().required(),
  }),
};

// const priceSchema = joi.object({
//   boxId: joi.string().uuid().required(),
//   price: joi.number().required(),
//   gst: joi.number().required(),
//   sportId: joi.string().uuid().required(),
//   sportName: joi.string().required(),
//   boxName: joi.string().required(),
//   isBooked: joi.boolean().required(),
// });


const slotSchema = joi.object({
  startTime: joi
    .string()
    .required()
    .pattern(/^(([01]\d|2[0-3]):(00|30):00|00:00:00)$/),
  endTime: joi
    .string()
    .required()
    .pattern(/^(([01]\d|2[0-3]):(00|30):00|00:00:00)$/),
  prices: joi.number().required(),
});

const createBookingValidation: RequestSchema = {
  body: joi.object({
    venueId: joi.string().uuid().required(),
    ownerId: joi.string().uuid().optional(),
    boxId: joi.string().uuid().required(),
    sportId: joi.string().uuid().required(),
    bookingDate: joi.date().iso().required(),

    slots: joi.array().items(slotSchema).min(1).required(),

    bookingAmount: joi
      .object({
        total: joi.number().required(),
        base: joi.number().required(),
        GST: joi.number().required(),
      })
      .required(),

    convenienceFees: joi
      .object({
        total: joi.number().required(),
        platFormFee: joi.number().required(),
        GST: joi.number().required(),
        paymentGateWayFee: joi.number().required(),
      })
      .required(),

    totalAmount: joi.number().required(),
    paidAmount: joi.number().required(),
    dueAmount: joi.number().required(),

    paymentStatus: joi.string().valid("partial", "full_paid").required(),
    customerDetails: joi
      .object({
        name: joi.string().required(),
        phone: joi
          .string()
          .custom(validateIndianPhone)
          .required()
          .messages(constant.PHONE_MESSAGES),
      })
      .required(),
  }),
};

const bookingListValidation: RequestSchema = {
  query: joi.object({
    venueId: joi.string().uuid().required(),
    targetDate: joi
      .string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    targetBoxId: joi.string().uuid().optional(),
    page: joi.number().integer().optional(),
  }),
};

const markPaidValidation: RequestSchema = {
  body: joi.object().keys({
    bookingId: joi.string().uuid().required(),
  }),
};

const cancellationBookingValidation: RequestSchema = {
  body: joi.object().keys({
    bookingId: joi.string().uuid().required(),
    refundAmount: joi.number().required(),
  }),
};
const listSlotsUserValidation: RequestSchema = {
  query: joi.object({
    venueId: joi.string().uuid().required(),
    sportId: joi.string().uuid().required(),
  }),
};

// const userBookingListValidation: RequestSchema = {
//   query: joi.object({
//     venueId: joi.string().uuid().required(),
//     targetDate: joi
//       .string()
//       .pattern(/^\d{4}-\d{2}-\d{2}$/)
//       .optional(),
//     targetBoxId: joi.string().uuid().optional(),
//     page: joi.number().integer().optional(),
//   }),
// };

const addBookingUserValidation: RequestSchema = {
  body: joi.object({
    venueId: joi.string().uuid().required(),
    boxId: joi.string().uuid().required(),
    sportId: joi.string().uuid().required(),
    bookingDate: joi.date().iso().required(),
    paymentStatus: joi.string().valid("partial", "full_paid", "pending").required(),
    slots: joi.array().items(slotSchema).min(1).required(),
  }),
};

const userBookingListValidation: RequestSchema = {
  query: joi.object({
    customerId: joi.string().uuid().required(),
    page:joi.number().integer().optional(),
    limit:joi.number().integer().optional()
  })
};

const deleteUserBookingValidation: RequestSchema = {
  params: joi.object().keys({
    bookingId: joi.string().uuid().required(),
  }),
};


export default {
  listSlotsValidation,
  listBoxesValidation,
  createBookingValidation,
  bookingListValidation,
  markPaidValidation,
  cancellationBookingValidation,
  listSlotsUserValidation,
  userBookingListValidation,
  addBookingUserValidation,
  deleteUserBookingValidation
};
