import { Sequelize, Op, where, fn, col } from "sequelize";
import { StatusCodes } from "http-status-codes";
import { Request } from "express";
import config from "../../../common/config/config";
import Owners from "../../../database/models/box_owners";
import CustomAppError, { handleError } from "../../../common/utils/appError";
import bcrypt from "bcrypt";
import tokenServices from "../../../common/services/tokenServices";
import Attempt from "../../../database/models/attempt";
import generateOTP from "../../../common/utils/generateOTP";
import { sendEmail } from "../../../common/services/emailServices";
import logger from "../../../common/config/logger";
import {
  ChangePasswordBody,
  failedAttempt,
  ForgotPasswordBody,
  LoginBody,
  ResendOTPBody,
  ResetPasswordBody,
  SetPasswordBody,
  VerifyOTPBody,
} from "../../../common/utils/types";
import constant from "../../../common/config/constant";
import { getModuleVersion } from "../../../common/utils/getModuleVersion";
import Venues from "../../../database/models/venues";
import Business from "../../../database/models/businesses";
import { findOneWithScope } from "../../../common/utils/findOneWithScope";
import sequelize from "sequelize";
import { validatePasswordAgainstPersonalInfo } from "../../../common/utils/helper";

const version = getModuleVersion("auth", "manager");

const setPassword = async (body: SetPasswordBody, req: Request) => {
  try {
    const { email, newPassword, confirmPassword } = body;
    if (newPassword !== confirmPassword) {
      throw new CustomAppError(
        StatusCodes.BAD_REQUEST,
        req.t("errorMessages.password_not_match")
      );
    }

    const whereClause = {
      [Op.or]: [
        Sequelize.where(
          Sequelize.literal(
            `decrypt_data(email_address::bytea, '${config.encryption.dbEncryptionKey}')`
          ),
          {
            [Op.eq]: email,
          }
        ),
      ],
    };
    const owner = await findOneWithScope(Owners, "getOwner", whereClause, [
      "id",
    ]);
    if (!owner) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.userNotFound")
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await Owners.update(
      { hash: hashedPassword, status: constant.COMMON_STATUS.ACTIVE },
      { where: { id: owner.id } }
    );
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

const login = async (body: LoginBody, req: Request) => {
  try {
    const { email, phone, password, fcmToken } = body;

    if (!email && !phone) {
      throw new CustomAppError(
        StatusCodes.BAD_REQUEST,
        req.t("errorMessages.email_or_phone")
      );
    }

    const now = new Date();
    const phoneNumber = phone ? phone.replace("+91", "") : null;

    const whereClause = {
      [Op.or]: [
        ...(email
          ? [
              Sequelize.where(
                Sequelize.literal(
                  `decrypt_data(email_address, '${config.encryption.dbEncryptionKey}')`
                ),
                { [Op.eq]: email }
              ),
            ]
          : []),
        ...(phoneNumber
          ? [
              Sequelize.where(
                Sequelize.literal(
                  `decrypt_data(phone_number, '${config.encryption.dbEncryptionKey}')`
                ),
                { [Op.eq]: phoneNumber }
              ),
            ]
          : []),
      ],
    };

    const owner = await findOneWithScope(Owners, "getOwner", whereClause, [
      "id",
      "hash",
      "fcmToken",
      "fullName",
      "countryCode",
      "status",
      [
        Sequelize.literal(
          `decrypt_data(phone_number::bytea, '${config.encryption.dbEncryptionKey}')`
        ),
        "phoneNumber",
      ],
    ]);

    if (!owner) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.incorrect_credentials")
      );
    }
    if (owner.status !== constant.STATUS.ACTIVE) {
      throw new CustomAppError(
        StatusCodes.FORBIDDEN,
        req.t("errorMessages.contact_admin")
      );
    }

    if (fcmToken) {
      const ownerFcmTokens = owner.fcmToken || [];
      if (!ownerFcmTokens.includes(fcmToken)) {
        ownerFcmTokens.push(fcmToken);
        await Owners.update(
          { fcmToken: ownerFcmTokens },
          { where: { id: owner.id } }
        );
      }
    }

    // Parallelize attempt fetch and business fetch

    const [attempt, businessDetails] = await Promise.all([
      (async () => {
        let attempt = await Attempt.findOne({
          where: {
            userId: owner.id,
            endPoint: constant.END_POINT.LOGIN,
          },
        });

        if (!attempt) {
          attempt = await Attempt.create({
            userId: owner.id,
            endPoint: constant.END_POINT.LOGIN,
            failedAttempt: 0,
            failedTimeStamp: now,
            userRole: constant.ROLE.OWNER,
          });
        }

        return attempt;
      })(),
      Business.findAll({
        where: {
          boxOwnerId: { [Op.contains]: [owner.id] },
        },
        attributes: ["id", "businessName"],
      }),
    ]);

    // Lockout logic
    if ((attempt.failedAttempt ?? 0) >= 5) {
      const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

      if (
        !attempt.failedTimeStamp ||
        attempt.failedTimeStamp <= fifteenMinutesAgo
      ) {
        await attempt.update({
          failedAttempt: 0,
          failedTimeStamp: now,
        });
      } else {
        throw new CustomAppError(
          StatusCodes.TOO_MANY_REQUESTS,
          req.t("errorMessages.to_many_attempt")
        );
      }
    }

    // Password check
    const isPasswordValid = await bcrypt.compare(password, owner.hash || "");

    if (!isPasswordValid) {
      const newAttempt = Math.min((attempt.failedAttempt ?? 0) + 1, 5);

      await attempt.update({
        failedAttempt: newAttempt as failedAttempt,
        failedTimeStamp: now,
      });

      if (newAttempt >= 5) {
        throw new CustomAppError(
          StatusCodes.TOO_MANY_REQUESTS,
          req.t("errorMessages.to_many_attempt")
        );
      }

      throw new CustomAppError(
        StatusCodes.UNAUTHORIZED,
        req.t("errorMessages.incorrect_credentials")
      );
    }

    // Reset failed attempt only if needed
    if (attempt.failedAttempt !== 0) {
      await attempt.update({
        failedAttempt: 0,
        failedTimeStamp: now,
      });
    }

    const businessIds = businessDetails.map((b) => b.id);

    if (businessIds.length === 0) {
      return {
        accessToken: "",
        refreshToken: "",
        venueDetails: [],
      };
    }

    // Fetch venues in parallel
    const venuesData = await Venues.findAll({
      where: { businessId: { [Op.in]: businessIds } },
      attributes: ["id", "venueName", "businessId"],
    });

    // Group venues
    const venuesByBusiness = new Map<string, { id: string; name: string }[]>();

    for (const venue of venuesData) {
      const bid = venue.businessId as string;
      if (!venuesByBusiness.has(bid)) {
        venuesByBusiness.set(bid, []);
      }
      venuesByBusiness.get(bid)!.push({
        id: venue.id,
        name: venue.venueName ?? "",
      });
    }

    const venueDetails = businessDetails.flatMap((business) => {
      const venues = venuesByBusiness.get(business.id) || [];

      return venues.map((venue) => ({
        id: venue.id,
        name: `${business.businessName} - ${venue.name}`,
      }));
    });

    // Generate tokens
    const authTokens = await tokenServices.generateAuthTokens(
      owner.id,
      constant.ROLE.OWNER
    );

    return {
      accessToken: authTokens.access.token,
      refreshToken: authTokens.refresh.token,
      venueDetails,
      countryCode: owner.countryCode || "",
      phoneNumber: owner.phoneNumber || "",
      email,
      fullName: owner.fullName || "",
      ownerId: owner.id,
    };
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

const forgotPassword = async (
  body: ForgotPasswordBody,
  req: Request,
  endpoint: string
) => {
  try {
    const { email } = body;

    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const whereClause = where(
      fn(
        "decrypt_data",
        col("email_address"),
        config.encryption.dbEncryptionKey
      ),
      { [Op.eq]: email }
    );

    const owner = await findOneWithScope(Owners, "getOwner", whereClause, [
      "id",
      "fullName",
      "status"
    ]);

    if (!owner) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.user_not_email")
      );
    }

    if(owner.status !== constant.STATUS.ACTIVE){
      throw new CustomAppError(
        StatusCodes.FORBIDDEN,
        req.t("errorMessages.contact_admin")
      );

    }

    const attempt = await Attempt.findOne({
      where: {
        userId: owner.id,
        endPoint: endpoint,
      },
    });

    const failedAttempts = attempt?.failedAttempt ?? 0;
    const lastFailedTime = attempt?.failedTimeStamp ?? now;

    if (failedAttempts >= 5 && lastFailedTime > fifteenMinutesAgo) {
      throw new CustomAppError(
        StatusCodes.TOO_MANY_REQUESTS,
        req.t("errorMessages.to_many_attempt")
      );
    }

    if (attempt) {
      await attempt.update({
        failedAttempt:
          lastFailedTime <= fifteenMinutesAgo
            ? 1
            : ((failedAttempts + 1) as failedAttempt),
        failedTimeStamp: now,
      });
    } else {
      await Attempt.create({
        userId: owner.id,
        endPoint: endpoint,
        failedAttempt: 1,
        failedTimeStamp: now,
        userRole: constant.ROLE.OWNER,
      });
    }

    const otp = generateOTP();
    const otpExpiry = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

    await Owners.update({ otp, otpExpiry }, { where: { id: owner.id } });

    setImmediate(async () => {
      try {
        await sendEmail({
          to: email,
          templateId: "forgotPasswordOtp",
          dynamicTemplateData: {
            firstName: owner.fullName,
            otp,
          },
          subject: "Reset Your Password - SportNX",
        });
        logger.info("OTP email sent to", email);
      } catch (emailErr) {
        logger.error("Failed to send OTP email:", emailErr);
      }
    });


    return {
      otp,
    };
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.HIGH,
    });
  }
};

const verifyOTP = async (body: VerifyOTPBody, req: Request) => {
  try {
    const { email, phone, otp } = body;

    if (!email && !phone) {
      throw new CustomAppError(
        StatusCodes.BAD_REQUEST,
        req.t("errorMessages.email_or_phone")
      );
    }

    const phoneNumber = phone ? phone.replace("+91", "") : null;

    const whereClause = {
      [Op.or]: [
        ...(email
          ? [
              Sequelize.where(
                Sequelize.literal(
                  `decrypt_data(email_address, '${config.encryption.dbEncryptionKey}')`
                ),
                {
                  [Op.eq]: email,
                }
              ),
            ]
          : []),
        ...(phoneNumber
          ? [
              Sequelize.where(
                Sequelize.literal(
                  `decrypt_data(phone_number, '${config.encryption.dbEncryptionKey}')`
                ),
                {
                  [Op.eq]: phoneNumber,
                }
              ),
            ]
          : []),
      ],
    };

    const owner = await findOneWithScope(Owners, "getOwner", whereClause, [
      "id",
      "otp",
      "otpExpiry",
    ]);

    if (!owner) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.userNotFound")
      );
    }

    // Check if OTP has expired
    if (!owner.otpExpiry || new Date() > owner.otpExpiry) {
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
        userId: owner.id,
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

    if (owner.otp !== Number(otp)) {
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
          userId: owner.id,
          endPoint: endpoint,
          failedAttempt: 1,
          failedTimeStamp: now,
          userRole: constant.ROLE.OWNER,
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

    await Owners.update(
      {
        otp: null,
        otpExpiry: null,
      },
      {
        where: { id: owner.id },
      }
    );
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

const resendOTP = async (
  body: ResendOTPBody,
  req: Request,
  endpoint: string
) => {
  try {
    const { email } = body;
    const encryptionKey = config.encryption.dbEncryptionKey;
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const whereClause = {
      [Op.or]: [
        Sequelize.where(
          Sequelize.literal(`decrypt_data(email_address, '${encryptionKey}')`),
          {
            [Op.eq]: email,
          }
        ),
      ],
    };

    const owner = await findOneWithScope(Owners, "getOwner", whereClause, [
      "id",
      "fullName",
    ]);

    if (!owner) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.user_not_email")
      );
    }

    const [attempt, created] = await Attempt.findOrCreate({
      where: {
        userId: owner.id,
        endPoint: endpoint,
      },
      defaults: {
        failedAttempt: 1,
        failedTimeStamp: now,
        userRole: constant.ROLE.OWNER,
      },
    });

    if (!created) {
      const failedAttempts = attempt.failedAttempt ?? 0;
      const lastTime = attempt.failedTimeStamp;

      if (failedAttempts >= 5) {
        if (!lastTime || lastTime <= fifteenMinutesAgo) {
          // Reset after 15 minutes
          await attempt.update({
            failedAttempt: 1,
            failedTimeStamp: now,
          });
        } else {
          throw new CustomAppError(
            StatusCodes.TOO_MANY_REQUESTS,
            req.t("errorMessages.to_many_attempt")
          );
        }
      } else {
        // Increment attempt
        await attempt.update({
          failedAttempt: (failedAttempts + 1) as failedAttempt,
          failedTimeStamp: now,
        });
      }
    }

    const otp = generateOTP();
    const otpExpiry = new Date(now.getTime() + 15 * 60 * 1000);

    await Owners.update(
      {
        otp,
        otpExpiry,
      },
      {
        where: { id: owner.id },
      }
    );

    setImmediate(async () => {
      try {
        await sendEmail({
          to: email,
          templateId: "forgotPasswordOtp",
          dynamicTemplateData: {
            firstName: owner?.fullName,
            otp,
          },
          subject: "Reset Your Password - SportNX",
        });
      } catch (emailErr) {
        logger.error("Failed to send OTP email:", emailErr);
      }
    });

    logger.debug("OTP ========> ", otp);

    return { otp };
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.HIGH,
    });
  }
};

const resetPassword = async (body: ResetPasswordBody, req: Request) => {
  try {
    const { email, phone, newPassword, confirmPassword } = body;

    if (newPassword !== confirmPassword) {
      throw new CustomAppError(
        StatusCodes.BAD_REQUEST,
        req.t("errorMessages.password_not_match")
      );
    }

    if (!email && !phone) {
      throw new CustomAppError(
        StatusCodes.BAD_REQUEST,
        req.t("errorMessages.email_or_phone")
      );
    }

    const phoneNumber = phone ? phone.replace("+91", "") : null;

    const whereClause = {
      [Op.or]: [
        ...(email
          ? [
              Sequelize.where(
                Sequelize.literal(
                  `decrypt_data(email_address, '${config.encryption.dbEncryptionKey}')`
                ),
                {
                  [Op.eq]: email,
                }
              ),
            ]
          : []),
        ...(phoneNumber
          ? [
              Sequelize.where(
                Sequelize.literal(
                  `decrypt_data(phone_number, '${config.encryption.dbEncryptionKey}')`
                ),
                {
                  [Op.eq]: phoneNumber,
                }
              ),
            ]
          : []),
      ],
    };

    const owner = await Owners.scope({
      method: [
        "getOwner",
        whereClause,
        config.encryption.dbEncryptionKey,
        [
          "id",
          "fullName",
          "passwordHistory",
          [
            sequelize.literal(
              `decrypt_data(email_address::bytea, '${config.encryption.dbEncryptionKey}')`
            ),
            "emailAddress",
          ],
          [
            sequelize.literal(
              `decrypt_data(phone_number::bytea, '${config.encryption.dbEncryptionKey}')`
            ),
            "phoneNumber",
          ],
        ],
      ],
    }).findOne();

    if (!owner) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.userNotFound")
      );
    }

    const isPersonalInfoValid = validatePasswordAgainstPersonalInfo({
      fullName: owner.fullName,
      phoneNumber: owner.phoneNumber ? String(owner.phoneNumber) : undefined,
      emailAddress: owner.emailAddress ? String(owner.emailAddress) : undefined,
      newPassword,
    });

    if (!isPersonalInfoValid) {
      throw new CustomAppError(
        StatusCodes.BAD_REQUEST,
        req.t("errorMessages.password_contains_personal_info")
      );
    }

    if (owner.passwordHistory && owner.passwordHistory.length > 0) {
      for (const oldHashedPassword of owner.passwordHistory) {
        const isPasswordMatch = await bcrypt.compare(
          newPassword,
          oldHashedPassword
        );
        if (isPasswordMatch) {
          throw new CustomAppError(
            StatusCodes.BAD_REQUEST,
            req.t("errorMessages.password_already_used")
          );
        }
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const history = Array.isArray(owner.passwordHistory)
      ? owner.passwordHistory
      : [];

    history.push(hashedPassword);

    if (history.length > 5) {
      history.shift();
    }

    await Owners.update(
      {
        hash: hashedPassword,
        passwordHistory: history,
      },
      {
        where: { id: owner.id },
      }
    );
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

const changePassword = async (body: ChangePasswordBody, req: Request) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = body;
    const userId = req.user?.id;
    const now = new Date();

    if (!userId) {
      throw new CustomAppError(
        StatusCodes.UNAUTHORIZED,
        req.t("errorMessages.unauthorized")
      );
    }

    const owner = await Owners.findOne({ where: { id: userId } });
    if (!owner) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.userNotFound")
      );
    }

    // ✅ Fetch or create attempt record for CHANGE_PASSWORD
    let attempt = await Attempt.findOne({
      where: {
        userId: owner.id,
        endPoint: constant.END_POINT.CHANGEPASSWORD,
      },
    });
    if (!attempt) {
      attempt = await Attempt.create({
        userId: owner.id,
        endPoint: constant.END_POINT.CHANGEPASSWORD,
        failedAttempt: 0,
        failedTimeStamp: now,
        userRole: constant.ROLE.OWNER,
      });
    }

    // ✅ Lockout check
    if ((attempt.failedAttempt ?? 0) >= 5) {
      const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

      if (
        !attempt.failedTimeStamp ||
        attempt.failedTimeStamp <= fifteenMinutesAgo
      ) {
        // Reset attempts after cooldown
        await attempt.update({
          failedAttempt: 0,
          failedTimeStamp: now,
        });
      } else {
        throw new CustomAppError(
          StatusCodes.TOO_MANY_REQUESTS,
          req.t("errorMessages.to_many_attempt")
        );
      }
    }

    // ✅ Current password validation
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      owner.hash || ""
    );
    const failedAttempts = attempt?.failedAttempt ?? 0;
    if (!isCurrentPasswordValid) {
      const newAttempt = (failedAttempts + 1) as failedAttempt;
      await attempt.update({
        failedAttempt: newAttempt,
        failedTimeStamp: now,
      });

      if (newAttempt >= 5) {
        throw new CustomAppError(
          StatusCodes.TOO_MANY_REQUESTS,
          req.t("errorMessages.to_many_attempt")
        );
      }

      throw new CustomAppError(
        StatusCodes.BAD_REQUEST,
        req.t("errorMessages.invalid_current_password")
      );
    }

    // ✅ Basic checks
    if (newPassword === currentPassword) {
      throw new CustomAppError(
        StatusCodes.BAD_REQUEST,
        req.t("errorMessages.new_password_same_as_old")
      );
    }
    if (newPassword !== confirmPassword) {
      throw new CustomAppError(
        StatusCodes.BAD_REQUEST,
        req.t("errorMessages.password_not_match")
      );
    }

    // ✅ Reset attempts after success
    if (attempt.failedAttempt !== 0) {
      await attempt.update({
        failedAttempt: 0,
        failedTimeStamp: now,
      });
    }

    // ✅ Prevent password reuse
    if (owner.passwordHistory?.length) {
      for (const oldHashedPassword of owner.passwordHistory) {
        const match = await bcrypt.compare(newPassword, oldHashedPassword);
        if (match) {
          throw new CustomAppError(
            StatusCodes.BAD_REQUEST,
            req.t("errorMessages.password_already_used")
          );
        }
      }
    }

    // ✅ Save new password + history
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const newHistory = [...(owner.passwordHistory || []), hashedPassword];
    if (newHistory.length > 5) newHistory.shift();

    await Owners.update(
      {
        hash: hashedPassword,
        passwordHistory: newHistory,
      },
      { where: { id: userId } }
    );
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.HIGH,
    });
  }
};

const checkPassword = async (req: Request) => {
  try {
    const { email } = req.body;
    logger.info("email:===>", email);
    const whereClause = where(
      fn(
        "decrypt_data",
        col("email_address"),
        config.encryption.dbEncryptionKey
      ),
      { [Op.eq]: email }
    );

    const owner = await findOneWithScope(Owners, "getOwner", whereClause, [
      "hash",
    ]);

    if (!owner) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.user_not_email")
      );
    }

    // ✅ If user already has a password, return a flag
    if (owner.hash) {
      return { hasPassword: true };
    }

    // ✅ If user has no password set yet
    return { hasPassword: false };
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.HIGH,
    });
  }
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
