import joi from "joi";
import { RequestSchema } from "../../common/utils/types";
import { validateIndianPhone } from "../../common/utils/helper";
import constant from "../../common/config/constant";

const setSports: RequestSchema = {
  body: joi.object().keys({
    phone: joi
      .string()
      .required()
      .custom(validateIndianPhone)
      .messages(constant.PHONE_MESSAGES),
    sportId: joi.string().uuid().required(),
  }),
};

const setLocation: RequestSchema = {
  body: joi.object().keys({
    city: joi.string().required(),
    longitude: joi.number().required().messages({
      "number.base": "Longitude must be a valid number.",
    }),
    latitude: joi.number().required().messages({
      "number.base": "Latitude must be a valid number.",
    }),
    phone: joi
      .string()
      .required()
      .custom(validateIndianPhone)
      .messages(constant.PHONE_MESSAGES),
  }),
};

export default {
  setSports,
  setLocation,
};
