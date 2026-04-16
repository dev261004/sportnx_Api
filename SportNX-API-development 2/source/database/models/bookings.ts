import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";
import constant from "../../common/config/constant";
import { BookingAttributes } from "../../common/utils/types";

type BookingCreationAttributes = Partial<Omit<BookingAttributes, "id">>;

interface BookingInstance
  extends Model<BookingAttributes, BookingCreationAttributes>,
    BookingAttributes {}

const Bookings = sequelize.define<BookingInstance>(
  "bookings",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    customerId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "customer_id",
      references: {
        model: "customers",
        key: "id",
      },
    },

    ownerId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "owner_id",
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

    bookingDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "booking_date",
    },

    startTime: {
      type: DataTypes.TIME,
      allowNull: false,
      field: "start_time",
    },

    endTime: {
      type: DataTypes.TIME,
      allowNull: false,
      field: "end_time",
    },

    startTs: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "start_ts",
    },

    endTs: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "end_ts",
    },

    bookingTsrange: {
      type: DataTypes.RANGE(DataTypes.DATE),
      allowNull: true,
      field: "booking_tsrange",
    },


    customerDetails: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: "customer_details",
    },

    slotPrices: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: "slot_prices",
    },

    paidAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: "paid_amount",
    },

    paymentStatus: {
      type: DataTypes.ENUM(
        constant.PAYMENT_STATUS.PARTIAL,
        constant.PAYMENT_STATUS.FULL_PAID,
        constant.PAYMENT_STATUS.PENDING,
        constant.PAYMENT_STATUS.REFUNDED
      ),
      allowNull: true,
      field: "payment_status",
    },

    dueAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: "due_amount",
    },

    bookingAmount: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: "booking_amount",
    },

    convenienceFees: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: "convenience_fee",
    },

    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: "total_amount",
    },

    bookingStatus: {
      type: DataTypes.ENUM(
        constant.BOOKING_STATUS.PENDING,
        constant.BOOKING_STATUS.CONFIRMED,
        constant.BOOKING_STATUS.CANCELLED,
        constant.BOOKING_STATUS.FAILED,
        constant.BOOKING_STATUS.EXPIRED
      ),
      allowNull: false,
      defaultValue: constant.BOOKING_STATUS.PENDING,
      field: "booking_status",
    },

    razorpayPaymentId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "razorpay_payment_id",
    },

    razorpayPaymentMethod: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "razorpay_payment_method",
    },

    refundAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: "refund_amount",
    },

    cancellationDetails: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: "cancellation_details",
    },

    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "expires_at",
    },
  },
  {
    tableName: "bookings",
    modelName: "Bookings",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",


  }
);

export default Bookings;
