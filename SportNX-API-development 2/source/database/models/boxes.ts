import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";
import constant from "../../common/config/constant";
import { BoxesAttributes } from "../../common/utils/types";

type BoxesCreationAttributes = Partial<Omit<BoxesAttributes, "id">>;
interface BoxesInstance
  extends Model<BoxesAttributes, BoxesCreationAttributes>,
    BoxesAttributes {}

const Boxes = sequelize.define<BoxesInstance>(
  "boxes",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    venueId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "venue_id",
      references: {
        model: "venues",
        key: "id",
      },
    },
    boxName: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "box_name",
    },
    status: {
      type: DataTypes.ENUM(constant.STATUS.ACTIVE, constant.STATUS.DISABLE),
      defaultValue: constant.STATUS.ACTIVE,
      allowNull: true,
      field: "status",
    },
  },
  {
    timestamps: true,
    modelName: "Boxes",
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "boxes",
  }
);

export default Boxes;
