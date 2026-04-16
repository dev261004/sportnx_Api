import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";
import BoxOwner from "./box_owners";
import Business from "./businesses";
import { PayoutAttributes } from "../../common/utils/types";

type PayoutCreationAttributes = Partial<Omit<PayoutAttributes, "id">>;

interface PayoutInstance
  extends Model<PayoutAttributes, PayoutCreationAttributes>,
    PayoutAttributes {}

const Payout = sequelize.define<PayoutInstance>(
  "payout",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    box_owner_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: BoxOwner,
        key: "id",
      },
    },
    business_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Business,
        key: "id",
      },
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    period: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("Pending", "Success", "Failed"),
      allowNull: false,
    },
    razorpay_payment_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    razorpay_payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    tableName: "payouts",
    timestamps: true,
    modelName: "Payout",
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default Payout;
