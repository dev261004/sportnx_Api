import Sequelize, { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";
import { CustomerAttributes } from "../../common/utils/types";
import config from "../../common/config/config";
import { escapeSingleQuotes } from "../../common/utils/helper";

type CustomerCreationAttributes = Partial<Omit<CustomerAttributes, "id">>;
interface CustomerInstance
  extends Model<CustomerAttributes, CustomerCreationAttributes>,
    CustomerAttributes {}

const Customer = sequelize.define<CustomerInstance>(
  "customers",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sportId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "sport_id",
      references: {
        model: "sports",
        key: "id",
      },
    },
    fullName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "full_name",
    },
    countryCode: {
      type: DataTypes.STRING(5),
      allowNull: false,
      field: "country_code",
    },
    phoneNumber: {
      type: DataTypes.BLOB,
      allowNull: false,
      unique: true,
      field: "phone_number",
    },
    latitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: true,
      field: "latitude",
    },
    longitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: true,
      field: "longitude",
    },
    location: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "location",
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
    razorpayCustomerId: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "razorpay_customer_id",
    },
    fcmToken: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: true,
      field: "fcm_token",
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    modelName: "Customer",
    tableName: "customers",
    hooks: {
      beforeCreate: (customer: CustomerInstance) => {
        const encryptField = (field: keyof CustomerAttributes) => {
          const value = customer.getDataValue(field);
          if (value) {
            let escapedValue = value;
            if (typeof value === "string" && value.length > 0) {
              escapedValue = escapeSingleQuotes(value);
            }
            const encryptedValue = sequelize.literal(
              `encrypt_data('${escapedValue}', '${config.encryption.dbEncryptionKey}')`
            ) as unknown as string;
            customer.setDataValue(field, encryptedValue);
          }
        };
        // Only encrypt phoneNumber
        encryptField("phoneNumber");
      },
      beforeUpdate: (customer: CustomerInstance) => {
        const encryptField = (field: keyof CustomerAttributes) => {
          if (customer.changed(field)) {
            const value = customer.getDataValue(field);
            if (value) {
              let escapedValue = value;
              if (typeof value === "string" && value.length > 0) {
                escapedValue = escapeSingleQuotes(value);
              }
              const encryptedValue = sequelize.literal(
                `encrypt_data('${escapedValue}', '${config.encryption.dbEncryptionKey}')`
              ) as unknown as string;
              customer.setDataValue(field, encryptedValue);
            }
          }
        };
        // Only encrypt phoneNumber
        encryptField("phoneNumber");
      },
    },
  }
);

// Add scope for decryption
Customer.addScope(
  "getCustomer",
  (
    whereClause: Record<string, unknown>,
    encryptionKey: string,
    attributes?: (
      | string
      | [
          (
            | string
            | ReturnType<typeof Sequelize.literal>
            | ReturnType<typeof Sequelize.fn>
            | ReturnType<typeof Sequelize.col>
          ),
          string
        ]
    )[]
  ): Sequelize.FindOptions<CustomerAttributes> => ({
    attributes:
      attributes && attributes.length > 0
        ? attributes
        : [
            "id",
            "sportId",
            "fullName",
            "countryCode",
            [
              sequelize.literal(
                `decrypt_data(phone_number::bytea, '${encryptionKey}')`
              ),
              "phoneNumber",
            ],
            "latitude",
            "longitude",
            "location",
            "otp",
            "otpExpiry",
            "razorpayCustomerId",
            "fcmToken",
          ],
    where: whereClause,
  })
);

export default Customer;
