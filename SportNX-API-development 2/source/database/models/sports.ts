import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";
import constant from "../../common/config/constant";
import { SportsAttributes } from "../../common/utils/types";

type SportsCreationAttributes = Partial<Omit<SportsAttributes, "id">>;
interface SportsInstance
  extends Model<SportsAttributes, SportsCreationAttributes>,
    SportsAttributes {}

const Sports = sequelize.define<SportsInstance>(
  "sports",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sportIcon: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "sport_icon",
    },
    sportName: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: "sport_name",
    },
    status: {
      type: DataTypes.ENUM(constant.STATUS.ACTIVE, constant.STATUS.DISABLE),
      defaultValue: constant.STATUS.ACTIVE,
      allowNull: true,
      field: "status",
    },
  },
  {
    tableName: "sports",
    timestamps: false,
    modelName: "Sports",
  }
);

export default Sports;
