import joi from "joi";
import { RequestSchema } from "../../../common/utils/types";
import {
  validateIndianPhone,
  validatePasswordComplexity,
  validateNoEmojiEmail,
} from "../../../common/utils/helper";
import constant from "../../../common/config/constant";

const setPassword: RequestSchema = {
  body: joi.object().keys({
    email: joi.string().email().required(),
    newPassword: joi
      .string()
      .required()
      .min(8)
      .max(16)
      .custom(validatePasswordComplexity)
      .messages(constant.PASSWORD_MESSAGES),
    confirmPassword: joi
      .string()
      .required()
      .min(8)
      .max(16)
      .custom(validatePasswordComplexity)
      .messages(constant.PASSWORD_MESSAGES),
  }),
};

const login: RequestSchema = {
  body: joi.object().keys({
    email: joi
      .string()
      .email()
      .optional()
      .custom(validateNoEmojiEmail)
      .messages({
        "string.emojiNotAllowed": "Email must not contain emojis",
      }),
    phone: joi
      .string()
      .optional()
      .custom(validateIndianPhone)
      .messages(constant.PHONE_MESSAGES),
    password: joi.string().required(),
    fcmToken: joi.string().required(),
  }),
};

const forgotPassword: RequestSchema = {
  body: joi.object().keys({
    email: joi.string().email().required().custom(validateNoEmojiEmail),
  }),
};

const verifyOTP: RequestSchema = {
  body: joi.object().keys({
    email: joi.string().email().optional().custom(validateNoEmojiEmail),
    phone: joi
      .string()
      .optional()
      .custom(validateIndianPhone)
      .messages(constant.PHONE_MESSAGES),
    otp: joi.string().required(),
  }),
};

const resendOTP: RequestSchema = {
  body: joi.object().keys({
    email: joi.string().email().required().custom(validateNoEmojiEmail),
  }),
};

const resetPassword: RequestSchema = {
  body: joi.object().keys({
    email: joi.string().email().optional().custom(validateNoEmojiEmail),
    phone: joi
      .string()
      .optional()
      .custom(validateIndianPhone)
      .messages(constant.PHONE_MESSAGES),
    newPassword: joi
      .string()
      .required()
      .min(8)
      .max(16)
      .custom(validatePasswordComplexity)
      .messages(constant.PASSWORD_MESSAGES),
    confirmPassword: joi
      .string()
      .required()
      .min(8)
      .max(16)
      .custom(validatePasswordComplexity)
      .messages(constant.PASSWORD_MESSAGES),
  }),
};

const changePassword: RequestSchema = {
  body: joi.object().keys({
    currentPassword: joi.string().required(),
    newPassword: joi
      .string()
      .required()
      .min(8)
      .max(16)
      .custom(validatePasswordComplexity)
      .messages(constant.PASSWORD_MESSAGES),
    confirmPassword: joi
      .string()
      .required()
      .valid(joi.ref("newPassword"))
      .messages(constant.PASSWORD_MESSAGES),
  }),
};

const checkPassword: RequestSchema = {
  body: joi.object().keys({
    email: joi.string().email().optional().custom(validateNoEmojiEmail),
  }),
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
