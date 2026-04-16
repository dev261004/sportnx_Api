import Sports from "./models/sports";
import Customer from "./models/customer";
import Owners from "./models/box_owners";
import Bookings from "./models/bookings";
import Venues from "./models/venues";
import Boxes from "./models/boxes";
import Attempt from "./models/attempt";
import BoxSportMapping from "./models/box_sport_mapping";
import Business from "./models/businesses";
import Payout from "./models/payouts";
import PayoutsCalculations from "./models/payouts_calculations";

const models = {
  Sports,
  Customer,
  Owners,
  Bookings,
  Venues,
  Boxes,
  Attempt,
  BoxSportMapping,
  Business,
  Payout,
  PayoutsCalculations,
};

// Sports & Customer
Sports.hasMany(Customer, { foreignKey: "sportId", as: "customers" });
Customer.belongsTo(Sports, { foreignKey: "sportId", as: "sports" });

// Owners & Business
Owners.hasMany(Business, { foreignKey: "boxOwnerId", as: "businesses" });
Business.belongsTo(Owners, { foreignKey: "boxOwnerId", as: "owner" });

// Business & Venues
Business.hasMany(Venues, { foreignKey: "businessId", as: "venues" });
Venues.belongsTo(Business, { foreignKey: "businessId", as: "business" });

// Venues & Boxes
Venues.hasMany(Boxes, { foreignKey: "venueId", as: "boxes" });
Boxes.belongsTo(Venues, { foreignKey: "venueId", as: "venue" });

// Boxes & BoxSportMapping
Boxes.hasMany(BoxSportMapping, { foreignKey: "boxId", as: "sportMappings" });
BoxSportMapping.belongsTo(Boxes, { foreignKey: "boxId", as: "box" });

// Sports & BoxSportMapping
Sports.hasMany(BoxSportMapping, { foreignKey: "sportId", as: "boxMappings" });
BoxSportMapping.belongsTo(Sports, { foreignKey: "sportId", as: "sport" });

// Bookings relations
Customer.hasMany(Bookings, { foreignKey: "customerId", as: "bookings" });
Bookings.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });

Venues.hasMany(Bookings, { foreignKey: "venueId", as: "bookings" });
Bookings.belongsTo(Venues, { foreignKey: "venueId", as: "bookingVenue" });

Boxes.hasMany(Bookings, { foreignKey: "boxId", as: "bookings" });
Bookings.belongsTo(Boxes, { foreignKey: "boxId", as: "box" });

Sports.hasMany(Bookings, { foreignKey: "sportId", as: "bookings" });
Bookings.belongsTo(Sports, { foreignKey: "sportId", as: "sport" });

// Payout Associations
Payout.belongsTo(Owners, { foreignKey: "box_owner_id", as: "boxOwner" });
Owners.hasMany(Payout, { foreignKey: "box_owner_id", as: "payouts" });

Payout.belongsTo(Business, { foreignKey: "business_id", as: "business" });
Business.hasMany(Payout, { foreignKey: "business_id", as: "payouts" });

// PayoutsCalculations Associations
PayoutsCalculations.belongsTo(Payout, {
  foreignKey: "payout_id",
  as: "payout",
});
Payout.hasMany(PayoutsCalculations, {
  foreignKey: "payout_id",
  as: "payoutCalculations",
});

PayoutsCalculations.belongsTo(Bookings, {
  foreignKey: "booking_id",
  as: "booking",
});
Bookings.hasMany(PayoutsCalculations, {
  foreignKey: "booking_id",
  as: "payoutCalculations",
});

PayoutsCalculations.belongsTo(Business, {
  foreignKey: "business_id",
  as: "business",
});
Business.hasMany(PayoutsCalculations, {
  foreignKey: "business_id",
  as: "payoutCalculations",
});

export { models };
