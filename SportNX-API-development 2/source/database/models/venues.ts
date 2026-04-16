import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";
import { VenueAttributes } from "../../common/utils/types";

type VenueCreationAttributes = Partial<Omit<VenueAttributes, "id">>;
interface VenueInstance
  extends Model<VenueAttributes, VenueCreationAttributes>,
    VenueAttributes {}

const Venues = sequelize.define<VenueInstance>(
  "venues",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    boxOwnerId: {
      // type: DataTypes.UUID,
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: false,
      field: "box_owner_id",
    },
    businessId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "business_id",
      references: {
        model: "businesses",
        key: "id",
      },
    },
    venueName: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "venue_name",
    },
    aboutVenue: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "about_venue",
    },
    venueTiming: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: "venue_timing",
    },
    venueMinPrice: {
      type: DataTypes.DECIMAL(7, 2),
      allowNull: true,
      field: "venue_min_price",
    },
    venueMaxPrice: {
      type: DataTypes.DECIMAL(7, 2),
      allowNull: true,
      field: "venue_max_price",
    },
    venueSports: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      field: "venue_sport",
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
      type: DataTypes.TEXT,
      allowNull: true,
      field: "location",
    },
    area: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "area",
    },
    city: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "city",
    },
    state: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "state",
    },
    country: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "country",
    },
    images: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      field: "images",
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true,
      field: "is_featured",
    },
    policy: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "venue_policy",
    },
  },
  {
    timestamps: true,
    modelName: "Venues",
    createdAt: "created_at",
    updatedAt: "updated_at",
    tableName: "venues",
  }
);

export default Venues;
