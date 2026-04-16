import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";
import { BoxSportMappingAttributes } from "../../common/utils/types";

type BoxSportMappingCreationAttributes = Partial<
  Omit<BoxSportMappingAttributes, "id">
>;
export interface BoxSportMappingInstance
  extends Model<BoxSportMappingAttributes, BoxSportMappingCreationAttributes>,
    BoxSportMappingAttributes {}

const BoxSportMapping = sequelize.define<BoxSportMappingInstance>(
  "box_sport_mapping",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    boxId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "box_id",
      references: {
        model: "boxes",
        key: "id",
      },
    },
    sportId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "sport_id",
      references: {
        model: "sports",
        key: "id",
      },
    },
    defaultPrice: {
      type: DataTypes.DECIMAL(7, 2),
      allowNull: true,
      field: "default_price",
    },
    gst: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: "gst",
    },
    timeSlotPrices: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: "time_slot_price",
    },
  },
  {
    timestamps: true,
    modelName: "BoxSportMapping",
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "box_sport_mapping",
  }
);

export default BoxSportMapping;
