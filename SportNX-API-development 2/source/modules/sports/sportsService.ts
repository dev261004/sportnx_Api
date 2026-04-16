import { Sequelize, Op } from "sequelize";
import { StatusCodes } from "http-status-codes";
import config from "../../common/config/config";
import Customer from "../../database/models/customer";
import Sports from "../../database/models/sports";
import CustomAppError, { handleError } from "../../common/utils/appError";
import { Request } from "express";
import constant from "../../common/config/constant";
import { SetLocationBody, SetSportsBody } from "../../common/utils/types";
import { findOneWithScope } from "../../common/utils/findOneWithScope";
import { getModuleVersion } from "../../common/utils/getModuleVersion";

const version = getModuleVersion("sports");

const setSports = async (body: SetSportsBody, req: Request) => {
  try {
    const { phone, sportId } = body;
    const phoneNumber = phone.replace("+91", "");

    const sport = await Sports.findByPk(sportId);
    if (!sport) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.sport_not_found")
      );
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

    const customer = await findOneWithScope(
      Customer,
      "getCustomer",
      whereClause,
      ["id"]
    );

    if (!customer) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.userNotFound")
      );
    }

    await Customer.update(
      { sportId: Sequelize.literal(`'${sportId}'`) },
      { where: { id: customer.id } }
    );
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

const getActiveSports = async (req: Request) => {
  try {
    const sports = await Sports.findAll({
      attributes: [
        ["id", "sportId"],
        ["sport_name", "sportName"],
        ["sport_icon", "sportIcon"],
      ],
      where: {
        status: constant.STATUS.ACTIVE,
      },
      order: [["sport_name", "ASC"]],
      raw: true,
    });

    return sports;
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

const setLocation = async (body: SetLocationBody, req: Request) => {
  try {
    const { phone, city, latitude, longitude } = body;
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

    await Customer.update(
      {
        location: city,
        latitude: parseFloat(latitude.toString()),
        longitude: parseFloat(longitude.toString()),
      },
      { where: { id: user.id } }
    );

    return true;
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

export default {
  setSports,
  getActiveSports,
  setLocation,
};
