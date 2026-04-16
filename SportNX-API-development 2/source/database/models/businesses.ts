// import { DataTypes, Model } from "sequelize";
// import { sequelize } from "../sequelize";
// import { BusinessAttributes } from "../../common/utils/types";
// import constant from "../../common/config/constant";

// type BusinessCreationAttributes = Partial<Omit<BusinessAttributes, "id">>;
// interface BusinessInstance
//   extends Model<BusinessAttributes, BusinessCreationAttributes>,
//     BusinessAttributes {}

// const Business = sequelize.define<BusinessInstance>(
//   "businesses",
//   {
//     id: {
//       type: DataTypes.UUID,
//       defaultValue: DataTypes.UUIDV4,
//       primaryKey: true,
//     },
//     boxOwnerId: {
//       // type: DataTypes.UUID,
//       type: DataTypes.ARRAY(DataTypes.UUID),
//       allowNull: false,
//       field: "box_owner_id",
//     },
//     businessName: {
//       type: DataTypes.STRING,
//       allowNull: false,
//       field: "business_name",
//     },
//     gstNumber: {
//       type: DataTypes.STRING(15),
//       allowNull: true,
//       field: "gst_number",
//     },
//     businessLogo: {
//       type: DataTypes.STRING(100),
//       allowNull: true,
//       field: "business_logo",
//     },
//     status: {
//       type: DataTypes.ENUM(
//         constant.COMMON_STATUS.ACTIVE,
//         constant.COMMON_STATUS.DISABLE,
//         constant.COMMON_STATUS.DELETED,
//         constant.COMMON_STATUS.INVITED
//       ),
//       allowNull: false,
//       defaultValue: constant.COMMON_STATUS.INVITED,
//       field: "status",
//     },
//     bankAccount: {
//       type: DataTypes.STRING,
//       allowNull: false,
//       field: "bank_account",
//     },
//   },
//   {
//     tableName: "businesses",
//     timestamps: true,
//     modelName: "Business",
//     createdAt: "created_at",
//     updatedAt: "updated_at",

//   }
// );

// export default Business;

import { DataTypes, Model, ProjectionAlias } from "sequelize";
import { sequelize } from "../sequelize";
import { BusinessAttributes } from "../../common/utils/types";
import constant from "../../common/config/constant";
import config from "../../common/config/config";
import { escapeSingleQuotes } from "../../common/utils/helper";

type BusinessCreationAttributes = Partial<Omit<BusinessAttributes, "id">>;
interface BusinessInstance
  extends Model<BusinessAttributes, BusinessCreationAttributes>,
    BusinessAttributes {}

const Business = sequelize.define<BusinessInstance>(
  "businesses",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    boxOwnerId: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: false,
      field: "box_owner_id",
    },
    businessName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "business_name",
    },
    gstNumber: {
      type: DataTypes.STRING(15),
      allowNull: true,
      field: "gst_number",
    },
    businessLogo: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "business_logo",
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
    bankAccount: {
      type: DataTypes.BLOB,
      allowNull: true,
      field: "bank_account",
    },
    ifscCode: {
      type: DataTypes.BLOB,
      allowNull: true,
      field: "ifsc_code",
    },
  },
  {
    tableName: "businesses",
    timestamps: true,
    modelName: "Business",
    createdAt: "created_at",
    updatedAt: "updated_at",
    hooks: {
      beforeCreate: (business: BusinessInstance) => {
        const encryptField = (field: keyof BusinessAttributes) => {
          const value = business.getDataValue(field);
          if (value) {
            let escapedValue = value;
            if (typeof value === "string" && value.length > 0) {
              escapedValue = escapeSingleQuotes(value);
            }
            const encryptedValue = sequelize.literal(
              `encrypt_data('${escapedValue}', '${config.encryption.dbEncryptionKey}')`
            );
            business.setDataValue(field, encryptedValue as unknown as string);
          }
        };

        // Encrypt both fields
        encryptField("bankAccount");
        encryptField("ifscCode");
      },
      beforeUpdate: (business: BusinessInstance) => {
        const encryptField = (field: keyof BusinessAttributes) => {
          if (business.changed(field)) {
            const value = business.getDataValue(field);
            if (value) {
              let escapedValue = value;
              if (typeof value === "string" && value.length > 0) {
                escapedValue = escapeSingleQuotes(value);
              }
              const encryptedValue = sequelize.literal(
                `encrypt_data('${escapedValue}', '${config.encryption.dbEncryptionKey}')`
              );
              business.setDataValue(field, encryptedValue as unknown as string);
            }
          }
        };

        // Encrypt both fields
        encryptField("bankAccount");
        encryptField("ifscCode");
      },
    },
  }
);

// ✅ Scope for decryption (like Owners.getOwner)
Business.addScope(
  "getBusiness",
  (whereClause: Record<string, unknown>, encryptionKey: string) => ({
    attributes: [
      "id",
      "businessName",
      "status",
      "boxOwnerId",
      "gstNumber",
      "businessLogo",
      [
        sequelize.literal(
          `decrypt_data(bank_account::bytea, '${encryptionKey}')`
        ),
        "bankAccount",
      ] as ProjectionAlias,
      [
        sequelize.literal(`decrypt_data(ifsc_code::bytea, '${encryptionKey}')`),
        "ifscCode",
      ] as ProjectionAlias,
    ],
    where: whereClause,
  })
);

export default Business;
