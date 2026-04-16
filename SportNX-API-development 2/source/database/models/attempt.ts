import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";
import { AttemptAttributes } from "../../common/utils/types";
import constant from "../../common/config/constant";

type AttemptCreationAttributes = Partial<Omit<AttemptAttributes, "id">>;
interface AttemptInstance
  extends Model<AttemptAttributes, AttemptCreationAttributes>,
    AttemptAttributes {}

const Attempt = sequelize.define<AttemptInstance>(
  "attempt",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "user_id",
    },
    userRole: {
      type: DataTypes.ENUM(constant.ROLE.USER, constant.ROLE.OWNER),
      allowNull: true,
      field: "user_role",
    },
    endPoint: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "endpoint",
    },
    failedTimeStamp: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "failed_timestamp",
    },
    failedAttempt: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "failed_attempt",
      validate: {
        min: 0,
        max: 5,
      },
    },
  },
  {
    tableName: "attempt",
    timestamps: true,
    modelName: "Attempt",
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default Attempt;
