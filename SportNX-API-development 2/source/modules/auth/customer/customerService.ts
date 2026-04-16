import { Sequelize, Op } from "sequelize";
import { StatusCodes } from "http-status-codes";
import { Request } from "express";
import config from "../../../common/config/config";
import Customer from "../../../database/models/customer";
import Attempt from "../../../database/models/attempt";
import generateOTP from "../../../common/utils/generateOTP";
import CustomAppError, { handleError } from "../../../common/utils/appError";
import tokenServices from "../../../common/services/tokenServices";
import Sports from "../../../database/models/sports";
import constant from "../../../common/config/constant";
import logger from "../../../common/config/logger";
import {
  // deleteUserQuery,
  editProfileBody,
  failedAttempt,
  LoginBodyUser,
  OnboardBody,
  ResendOTPBodyUser,
  VerifyOTPBodyUser,
} from "../../../common/utils/types";
import { findOneWithScope } from "../../../common/utils/findOneWithScope";
import { getModuleVersion } from "../../../common/utils/getModuleVersion";
import Bookings from "../../../database/models/bookings";

const version = getModuleVersion("auth", "customer");

const login = async (body: LoginBodyUser, req: Request) => {
  try {
    const { phone, latitude, longitude, location, sport, fcmToken } = body;
    const phoneNumber = phone.replace("+91", "");

    let sportId = sport;
    if (sport) {
      const sportRecord = await Sports.findOne({
        where: {
          id: sport,
          status: constant.STATUS.ACTIVE,
        },
        attributes: ["id"],
      });

      if (!sportRecord) {
        throw new CustomAppError(
          StatusCodes.NOT_FOUND,
          req.t("errorMessages.sport_not_found")
        );
      }
      sportId = sportRecord.id;
    }

    const whereClause = {
      [Op.or]: [
        Sequelize.where(
          Sequelize.literal(
            `decrypt_data(phone_number, '${config.encryption.dbEncryptionKey}')`
          ),
          {
            [Op.eq]: phoneNumber,
          }
        ),
      ],
    };

    let user = await findOneWithScope(Customer, "getCustomer", whereClause, [
      "id",
      [Sequelize.literal("full_name"), "fullName"],
      "fcmToken",
    ]);

    // logger.info("user",user?.fullName);

    if (!user) {
      user = await Customer.create({
        phoneNumber: phoneNumber,
        latitude: latitude ? parseFloat(latitude.toString()) : undefined,
        longitude: longitude ? parseFloat(longitude.toString()) : undefined,
        location,
        sportId: sportId,
        countryCode: "+91",
      fcmToken: fcmToken ? [fcmToken] : [],
      });



      if(user){
        logger.info("customerId updating...(user)");
        await Bookings.update(
        { customerId: user.id },
        {
         where: {
          [Op.and]: [
            Sequelize.where(
              // eslint-disable-next-line quotes
              Sequelize.literal(`customer_details ->> 'phone'`),
              { [Op.eq]: phone }
            ),
          {
            customerId: {
              [Op.is]: null,
            },
          },
        ],
      },
    }
      );
      }


      await Attempt.create({
        userId: user?.id,
        userRole: constant.ROLE.USER,
        endPoint: constant.END_POINT.RESENDOTP,
        failedTimeStamp: new Date(),
        failedAttempt: 0,
      });
    } else {
      const userFcmTokens = user.fcmToken || [];
      if (fcmToken && !userFcmTokens.includes(fcmToken)) {
        logger.info("customerId updating...");
        userFcmTokens.push(fcmToken);
        await Customer.update(
          { fcmToken: userFcmTokens },
          { where: { id: user.id } }
        );
        await Bookings.update(
        { customerId: user.id,
           customerDetails: Sequelize.literal(`
          jsonb_set(
            "customer_details",
            '{name}',
            to_jsonb('${user.fullName}'::text),
            true
          )
        `)
         },
        {
         where: {
          [Op.and]: [
            Sequelize.where(
              // eslint-disable-next-line quotes
              Sequelize.literal(`customer_details ->> 'phone'`),
              { [Op.eq]: phone }
            ),
          {
            customerId: {
              [Op.is]: null,
            },
          },
        ],
      },
    }
      );
       }
    }


    const otp = generateOTP();

    await Customer.update(
      {
        otp: otp,
        otpExpiry: new Date(Date.now() + 15 * 60 * 1000),
      },
      {
        where: { id: user?.id },
      }
    );

    logger.debug("OTP ========> ", otp);

    return { phone: phone, OTP: otp };
  } catch (error: unknown) {
    logger.info("error",error);
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.HIGH,
    });
  }
};

const verifyOTP = async (body: VerifyOTPBodyUser, req: Request) => {
  try {
    const { phone, otp } = body;
    const phoneNumber = phone.replace("+91", "");

    const whereClause = {
      [Op.or]: [
        Sequelize.where(
          Sequelize.literal(
            `decrypt_data(phone_number, '${config.encryption.dbEncryptionKey}')`
          ),
          {
            [Op.eq]: phoneNumber,
          }
        ),
      ],
    };

    const user = await findOneWithScope(Customer, "getCustomer", whereClause, [
      "id",
      "otp",
      "otpExpiry",
      "fullName",
      "latitude",
      "longitude",
      "location",
    ]);

    if (!user) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.userNotFound")
      );
    }

    // Check if OTP has expired
    if (!user.otpExpiry || new Date() > user.otpExpiry) {
      throw new CustomAppError(
        StatusCodes.GONE,
        req.t("errorMessages.otp_expired")
      );
    }

    const endpoint = constant.END_POINT.VERIFYOTP;
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const attempt = await Attempt.findOne({
      where: {
        userId: user.id,
        endPoint: endpoint,
      },
    });

    if (attempt) {
      if (
        (attempt.failedAttempt ?? 0) >= 5 &&
        (attempt.failedTimeStamp ?? new Date()) > fifteenMinutesAgo
      ) {
        throw new CustomAppError(
          StatusCodes.TOO_MANY_REQUESTS,
          req.t("errorMessages.to_many_attempt")
        );
      }
    }

    if (user.otp !== Number(otp)) {
      // Update attempt on wrong OTP
      if (attempt) {
        await attempt.update({
          failedAttempt:
            (attempt.failedTimeStamp ?? new Date()) <= fifteenMinutesAgo
              ? 1
              : (((attempt.failedAttempt ?? 0) + 1) as failedAttempt),
          failedTimeStamp: now,
        });
      } else {
        await Attempt.create({
          userId: user.id,
          endPoint: endpoint,
          failedAttempt: 1,
          failedTimeStamp: now,
          userRole: constant.ROLE.USER,
        });
      }
      throw new CustomAppError(
        StatusCodes.UNAUTHORIZED,
        req.t("errorMessages.otp_incorrect")
      );
    }

    // On success, reset attempt
    if (attempt) {
      await attempt.update({ failedAttempt: 0 });
    }

    const authTokens = await tokenServices.generateAuthTokens(
      user.id,
      constant.ROLE.USER
    );

    await Customer.update(
      {
        otp: null,
        otpExpiry: null,
      },
      {
        where: { id: user.id },
      }
    );

    const response = {
      accessToken: authTokens.access.token,
      refreshToken: authTokens.refresh.token,
      user: {
        id: user.id,
        full_name: user.fullName,
        latitude: user.latitude,
        longitude: user.longitude,
        location: user.location,
      },
    };

    return response;
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

const onboard = async (body: OnboardBody, req: Request) => {
  try {
    const { userid, name } = body;

    const customer = await Customer.findByPk(userid, {
      attributes: ["id"],
    });
    if (!customer) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.userNotFound")
      );
    }

    await Customer.update({ fullName: name }, { where: { id: userid } });
    await Bookings.update(
      {
        customerDetails: Sequelize.literal(`
          jsonb_set(
            "customer_details",
            '{name}',
            to_jsonb('${name}'::text),
            true
          )
        `)
      },
      {
        where: { customerId: userid }
      }
);
    return {
      name: name,
    };
  } catch (error: unknown) {
    logger.info("error",error);
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

const resendOTP = async (body: ResendOTPBodyUser, req: Request) => {
  try {
    const { phone } = body;
    const phoneNumber = phone.replace("+91", "");

    const whereClause = {
      [Op.or]: [
        Sequelize.where(
          Sequelize.literal(
            `decrypt_data(phone_number, '${config.encryption.dbEncryptionKey}')`
          ),
          {
            [Op.eq]: phoneNumber,
          }
        ),
      ],
    };

    const user = await findOneWithScope(Customer, "getCustomer", whereClause, [
      "id",
    ]);

    if (!user) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.userNotFound")
      );
    }

    const [attempt, created] = await Attempt.findOrCreate({
      where: {
        userId: user.id,
        endPoint: constant.END_POINT.RESENDOTP,
      },
      defaults: {
        failedAttempt: 1,
        failedTimeStamp: new Date(),
      },
    });

    if (!created) {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      if ((attempt.failedAttempt ?? 0) >= 5) {
        if (
          !attempt.failedTimeStamp ||
          attempt.failedTimeStamp <= fifteenMinutesAgo
        ) {
          await attempt.update({
            failedAttempt: 1,
            failedTimeStamp: new Date(),
          });
        } else {
          throw new CustomAppError(
            StatusCodes.TOO_MANY_REQUESTS,
            req.t("errorMessages.to_many_attempt")
          );
        }
      } else {
        const newAttempt = Math.min((attempt.failedAttempt ?? 1) + 1, 5);
        await attempt.update({
          failedAttempt: newAttempt as failedAttempt,
          failedTimeStamp: new Date(),
        });

        if (newAttempt >= 5) {
          throw new CustomAppError(
            StatusCodes.TOO_MANY_REQUESTS,
            req.t("errorMessages.to_many_attempt")
          );
        }
      }
    }
    const otp = generateOTP();

    await Customer.update(
      {
        otp: otp,
        otpExpiry: new Date(Date.now() + 15 * 60 * 1000),
      },
      {
        where: { id: user.id },
      }
    );

    logger.debug("OTP ========> ", otp);

    return { phone: phone, OTP: otp };
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.HIGH,
    });
  }
};

const editUserProfile = async (body: editProfileBody, req: Request) => {
  try {
    const {name, phone, userId } = body;
    const phoneWithoutCode = phone?.substring(3);
    logger.info("name",name);

    const user = await Customer.findByPk(userId, {
      attributes: ["id"],
    });

    if(!user){
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.userNotFound")
      );
    }
    
    user.phoneNumber = phoneWithoutCode;
    user.fullName = name;

    await user.save();  
    
await Bookings.update(
  {
    customerDetails: Sequelize.literal(`
      jsonb_set(
        jsonb_set(
          "customer_details",
          '{phone}',
          to_jsonb('${phone}'::text),
          true
        ),
        '{name}',
        to_jsonb('${name}'::text),
        true
      )
    `)
  },
  { where: { customerId: userId } }
);

    return {name:user.fullName,phoneNumber:phone,userId:user.id};

  }
  catch (error: unknown) {
    logger.info("error",error);
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

// const deleteUser = async(query: deleteUserQuery,req:Request)=>{
//   try{
//     const {customerId}=query;
//     logger.info("customerId",customerId);

//     const user = await Customer.findByPk(customerId, {
//       attributes: ["id"],
//     });

//     if(!user){
//       throw new CustomAppError(
//         StatusCodes.NOT_FOUND,
//         req.t("errorMessages.userNotFound")
//       );
//     }

//   await Customer.destroy({
//     where: {
//       id:customerId,
//       },
//     });
  
//   await Attempt.destroy({
//     where:{
//       userId:customerId,
//     },
//   });

//   return {name:user.fullName};

//   }
//   catch(error:unknown){
//      logger.info("error",error);
//     handleError(error, {
//       req,
//       version,
//       priority: constant.PRIORITY.LOW,
//     });
//   }
// };

export default {
  login,
  verifyOTP,
  onboard,
  resendOTP,
  editUserProfile,
  // deleteUser
};
