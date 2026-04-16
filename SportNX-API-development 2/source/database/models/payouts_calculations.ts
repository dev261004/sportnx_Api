import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";
import Payout from "./payouts";
import Bookings from "./bookings";
import Business from "./businesses";
import { PayoutsCalculationsAttributes } from "../../common/utils/types";

type PayoutsCalculationsCreationAttributes = Partial<
  Omit<PayoutsCalculationsAttributes, "id">
>;

interface PayoutsCalculationsInstance
  extends Model<
      PayoutsCalculationsAttributes,
      PayoutsCalculationsCreationAttributes
    >,
    PayoutsCalculationsAttributes {}

const PayoutsCalculations = sequelize.define<PayoutsCalculationsInstance>(
  "payouts_calculations",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    payout_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Payout,
        key: "id",
      },
    },
    booking_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Bookings,
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
    owner_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    payout_status: {
      type: DataTypes.ENUM("pending", "executed"),
      allowNull: false,
    },
  },
  {
    tableName: "payouts_calculations",
    timestamps: true,
    modelName: "PayoutsCalculations",
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default PayoutsCalculations;
