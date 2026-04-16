import joi from "joi";
import { RequestSchema } from "../../../common/utils/types";
import { validateIndianPhone } from "../../../common/utils/helper";
import constant from "../../../common/config/constant";

const login: RequestSchema = {
  body: joi.object().keys({
    phone: joi
      .string()
      .required()
      .custom(validateIndianPhone)
      .messages(constant.PHONE_MESSAGES),
    longitude: joi.number().optional().min(-180).max(180),
    latitude: joi.number().optional().min(-90).max(90),
    location: joi.string().optional(),
    sport: joi.string().uuid().optional(),
    fcmToken: joi.string().optional(),
  }),
};

const verifyOTP: RequestSchema = {
  body: joi.object().keys({
    phone: joi
      .string()
      .required()
      .custom(validateIndianPhone)
      .messages(constant.PHONE_MESSAGES),
    otp: joi.string().required(),
  }),
};

const onboard: RequestSchema = {
  body: joi.object().keys({
    userid: joi.string().uuid().required().messages({
      "string.guid": "Invalid user ID format",
    }),
    name: joi
      .string()
      .pattern(/^[a-zA-Z\s]+$/)
      .required()
      .messages({
        "string.pattern.base": "Name must contain only letters and spaces",
      }),
  }),
};

const resendOTP: RequestSchema = {
  body: joi.object().keys({
    phone: joi
      .string()
      .required()
      .custom(validateIndianPhone)
      .messages(constant.PHONE_MESSAGES),
  }),
};

const editUserProfile: RequestSchema = {
  body: joi.object().keys({
    userId:joi.string().uuid().required(),
    name: joi.string(),
    phone: joi
      .string()
      .required()
      .custom(validateIndianPhone)
      .messages(constant.PHONE_MESSAGES),
  })
};

// const deleteUser: RequestSchema = {
//     query: joi.object({
//       customerId: joi.string().uuid().required(),
//     })
// };

export default {
  login,
  verifyOTP,
  onboard,
  resendOTP,
  editUserProfile,
  // deleteUser
};
