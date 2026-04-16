import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";
import CustomAppError from "../utils/appError";
import Owners from "../../database/models/box_owners";
import Customer from "../../database/models/customer";
import { roleRights } from "../config/roles";
import createResponse from "../utils/response";
import { UserData, UserDetails } from "../utils/types";
import constant from "../config/constant";
import logger from "../config/logger";

declare module "express" {
  interface Request {
    user?: UserDetails;
  }
}

const auth =
  (requiredRight: string) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const secretKey: string = process.env.JWT_SECRET as string;
      const authHeader = req.header("Authorization");


      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new CustomAppError(
          StatusCodes.UNAUTHORIZED,
          req.t("errorMessages.no_token")
        );
      }

      const token = authHeader.split("Bearer ")[1].trim();
      const decoded = jwt.verify(token, secretKey) as unknown as {
        sub: UserData;
      };
      const userData = decoded.sub;

      if (requiredRight) {
        const userRights: string[] = roleRights.get(userData.role) || [];
        const hasRequiredRights = userRights.includes(requiredRight);

        if (!hasRequiredRights) {
          logger.info("errorr");
          throw new CustomAppError(
            StatusCodes.FORBIDDEN,
            req.t("errorMessages.access_denied")
          );
        }
      }

      let userExists;
      if (userData.role === constant.ROLE.OWNER) {
        userExists = await Owners.findByPk(userData.userId, {
          attributes: ["id"],
        });
      } else if (userData.role === constant.ROLE.USER) {
        userExists = await Customer.findByPk(userData.userId, {
          attributes: ["id"],
        });
      } else {
        throw new CustomAppError(
          StatusCodes.NOT_FOUND,
          req.t("errorMessages.role_not_found")
        );
      }

      if (!userExists?.id) {
        throw new CustomAppError(
          StatusCodes.NOT_FOUND,
          req.t("errorMessages.userNotFound")
        );
      }

      // Attach user info to request
      req.user = {
        id: userData.userId,
        role: userData.role,
      };

      next();
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message === "jwt expired") {
          createResponse(
            res,
            StatusCodes.UNAUTHORIZED,
            req.t("errorMessages.token_expired")
          );
        } else if (
          error.message === "invalid signature" ||
          error.message === "jwt malformed"
        ) {
          createResponse(
            res,
            StatusCodes.UNAUTHORIZED,
            req.t("errorMessages.invalid_token")
          );
        } else if (error instanceof CustomAppError) {
          createResponse(
            res,
            error.status || StatusCodes.INTERNAL_SERVER_ERROR,
            error.message
          );
        } else {
          createResponse(res, StatusCodes.INTERNAL_SERVER_ERROR, error.message);
        }
      } else {
        createResponse(
          res,
          StatusCodes.INTERNAL_SERVER_ERROR,
          "An unknown error occurred"
        );
      }
    }
  };

export default auth;
