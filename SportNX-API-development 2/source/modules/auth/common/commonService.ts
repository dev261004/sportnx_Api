import { StatusCodes } from "http-status-codes";
import tokenServices from "../../../common/services/tokenServices";
import CustomAppError, { handleError } from "../../../common/utils/appError";
import { Request } from "express";
import {
  logoutBody,
  refreshTokendBody,
  UserDetails,
} from "../../../common/utils/types";
import constant from "../../../common/config/constant";
import { getModuleVersion } from "../../../common/utils/getModuleVersion";
import Customer from "../../../database/models/customer";
import BoxOwner from "../../../database/models/box_owners";
import {
  S3Client,
  PutObjectCommand,
  ObjectCannedACL,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import config from "../../../common/config/config";
import sharp from "sharp";
import logger from "../../../common/config/logger";
// import path from "path";

const version = getModuleVersion("auth", "common");

const refreshToken = async (body: refreshTokendBody, req: Request) => {
  try {
    const { refresh_token } = body;

    const { decoded, error } = tokenServices.verifyRefreshToken(refresh_token);

    if (error || !decoded) {
      throw new CustomAppError(
        StatusCodes.UNAUTHORIZED,
        req.t("errorMessages.invalid_refresh_token")
      );
    }

    const userId =
      typeof decoded.sub === "string" ? decoded.sub : decoded.sub.userId;
    const role =
      typeof decoded.sub === "string" ? decoded.sub : decoded.sub.role;

    const authTokens = await tokenServices.generateAuthTokens(userId, role);

    return {
      accessToken: authTokens.access.token,
      refreshToken: authTokens.refresh.token,
    };
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

const logout = async (body: logoutBody, req: Request) => {
  try {
    const { fcmToken } = body;
    const { id: userId, role } = req.user as UserDetails;

    let user;
    if (role === constant.ROLE.USER) {
      user = await Customer.findOne({
        where: { id: userId },
        attributes: ["id", "fcmToken"],
      });
    } else if (role === constant.ROLE.OWNER) {
      user = await BoxOwner.findOne({
        where: { id: userId },
        attributes: ["id", "fcmToken"],
      });
    } else {
      throw new CustomAppError(
        StatusCodes.UNAUTHORIZED,
        req.t("errorMessages.role_not_found")
      );
    }
    if (!user) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.userNotFound")
      );
    }
    const userFcmTokens = user.fcmToken || [];
    const newFcmTokens = userFcmTokens.filter((token) => token !== fcmToken);
    if (role === constant.ROLE.USER) {
      await Customer.update(
        { fcmToken: newFcmTokens },
        { where: { id: user.id } }
      );
    } else if (role === constant.ROLE.OWNER) {
      await BoxOwner.update(
        { fcmToken: newFcmTokens },
        { where: { id: user.id } }
      );
    }
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

const s3 = new S3Client({
  region: config.region,
  endpoint: config.wasabisys,
  credentials: {
    accessKeyId: process.env.WASABI_KEY!,
    secretAccessKey: process.env.WASABISECRET!,
  },
});

const imageUpload = async (req: Request): Promise<string[] | undefined> => {
  try {
    logger.info("req.body:===>", req.body);
    if (!req.body?.base64) {
      throw new CustomAppError(
        StatusCodes.BAD_REQUEST,
        req.t("errorMessages.base64_not_prper")
      );
    }

    const base64Array = Array.isArray(req.body.base64)
      ? req.body.base64
      : [req.body.base64];

    const uploadPromises = base64Array.map(async (b64: string, idx: number) => {
      if (!/^data:image\/\w+;base64,/.test(b64)) {
        throw new CustomAppError(
          StatusCodes.BAD_REQUEST,
          req.t("errorMessages.base64")
        );
      }

      const base64Data = b64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new CustomAppError(
          StatusCodes.BAD_REQUEST,
          req.t("errorMessages.base64_not_buffer")
        );
      }
      logger.info("Buffer size:", buffer.length);
      const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();

      const key = `${Date.now()}-${idx}.webp`;
      const params = {
        Bucket: "sportnx",
        Key: key,
        Body: webpBuffer,
        ContentType: "image/webp",
        ACL: ObjectCannedACL.public_read,
      };

      await s3.send(new PutObjectCommand(params));

      return `${key}`;
    });
    logger.info("uploadPromises:===>", uploadPromises);
    return await Promise.all(uploadPromises);
  } catch (error: unknown) {
    handleError(error, {
      req,
      version: "1.0",
      priority: constant.PRIORITY.LOW,
    });
  }
};

const imageDelete = async (req: Request): Promise<string | undefined> => {
  try {
    const { imageName } = req.body;

    const params = {
      Bucket: "sportnx",
      Key: imageName,
    };

    await s3.send(new DeleteObjectCommand(params));

    logger.info(`Deleted image from Wasabi: ${imageName}`);

    return imageName; // return deleted key
  } catch (error: unknown) {
    handleError(error, {
      req,
      version: "1.0",
      priority: constant.PRIORITY.LOW,
    });
  }
};
export default {
  refreshToken,
  logout,
  imageUpload,
  imageDelete,
};
