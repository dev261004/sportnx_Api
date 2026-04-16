import joi from "joi";
import { RequestSchema } from "../../../common/utils/types";

const refreshToken: RequestSchema = {
  body: joi.object().keys({
    refresh_token: joi.string().required(),
  }),
};

const logout: RequestSchema = {
  body: joi.object().keys({
    fcmToken: joi.string().required(),
  }),
};

const imageDelete: RequestSchema = {
  body: joi.object().keys({
    imageName: joi.string().required(),
  }),
};
export default {
  refreshToken,
  logout,
  imageDelete,
};
