import { DataTypes, Model, Utils } from "sequelize";
import { sequelize } from "../sequelize";
import { BoxOwnerAttributes } from "../../common/utils/types";
import { escapeSingleQuotes } from "../../common/utils/helper";
import config from "../../common/config/config";
import constant from "../../common/config/constant";

type OwnersCreationAttributes = Partial<Omit<BoxOwnerAttributes, "id">>;
interface OwnersInstance
  extends Model<BoxOwnerAttributes, OwnersCreationAttributes>,
    BoxOwnerAttributes {}

const Owners = sequelize.define<OwnersInstance>(
  "box_owners",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    fullName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "full_name",
    },
    emailAddress: {
      type: DataTypes.BLOB,
      allowNull: true,
      field: "email_address",
    },
    countryCode: {
      type: DataTypes.STRING(5),
      allowNull: true,
      field: "country_code",
    },
    phoneNumber: {
      type: DataTypes.BLOB,
      allowNull: true,
      unique: true,
      field: "phone_number",
    },
    hash: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "hash",
    },
    passwordHistory: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: true,
      field: "password_history",
    },
    status: {
      type: DataTypes.ENUM(
        constant.COMMON_STATUS.ACTIVE,
        constant.COMMON_STATUS.DISABLE,
        constant.COMMON_STATUS.DELETED,
        constant.COMMON_STATUS.INVITED
      ),
      allowNull: false,
      defaultValue: constant.COMMON_STATUS.INVITED,
      field: "status",
    },
    otp: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "otp",
    },
    otpExpiry: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "otp_expiry",
    },
    fcmToken: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: true,
      field: "fcm_token",
    },
  },
  {
    tableName: "box_owners",
    modelName: "Owners",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    hooks: {
      beforeCreate: (owner: OwnersInstance) => {
        const encryptField = (field: keyof BoxOwnerAttributes) => {
          const value = owner.getDataValue(field);
          if (value) {
            let escapedValue = value;
            if (typeof value === "string" && value.length > 0) {
              escapedValue = escapeSingleQuotes(value);
            }
            const encryptedValue = sequelize.literal(
              `encrypt_data("${escapedValue}", "${config.encryption.dbEncryptionKey}")`
            );
            owner.setDataValue(field, encryptedValue as unknown as string);
          }
        };
        encryptField("emailAddress");
        encryptField("phoneNumber");
      },
      beforeUpdate: (owner: OwnersInstance) => {
        const encryptField = (field: keyof BoxOwnerAttributes) => {
          if (owner.changed(field)) {
            const value = owner.getDataValue(field);
            if (value) {
              let escapedValue = value;
              if (typeof value === "string" && value.length > 0) {
                escapedValue = escapeSingleQuotes(value);
              }
              const encryptedValue = sequelize.literal(
                `encrypt_data("${escapedValue}", "${config.encryption.dbEncryptionKey}")`
              );
              owner.setDataValue(field, encryptedValue as unknown as string);
            }
          }
        };
        // Encrypt both email and phone
        encryptField("emailAddress");
        encryptField("phoneNumber");
      },
    },
  }
);

Owners.addScope(
  "getOwner",
  (
    whereClause: Record<string, unknown>,
    encryptionKey: string,
    customAttributes?: (string | [Utils.Literal, string])[]
  ) => ({
    attributes: customAttributes || [
      "id",
      "fullName",
      "countryCode",
      [
        sequelize.literal(
          `decrypt_data(email_address::bytea, '${encryptionKey}')`
        ),
        "emailAddress",
      ],
      [
        sequelize.literal(
          `decrypt_data(phone_number::bytea, '${encryptionKey}')`
        ),
        "phoneNumber",
      ],
      "hash",
      "otp",
      "otpExpiry",
      "status",
      "fcmToken",
      "passwordHistory",
    ],
    where: whereClause,
  })
);

export default Owners;
