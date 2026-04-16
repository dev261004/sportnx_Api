import constant from "./constant";

const roleRights = new Map();

roleRights.set(constant.ROLE.OWNER, [
  "listBoxes",
  "logout",
  "updateBoxPrice",
  "updateVenueTiming",
  "updateBoxVariablePrice",
  "bookingList",
  "markAsPaid",
  "cancellationBooking",
  "getVenueDetail",
  "getBoxDetails",
  "changesPassword",
  "bookingUserList",
  "getOwnerVenueList"
]);

roleRights.set(constant.ROLE.USER, ["logout",  "userBookingList", "deleteUser"]);

export { roleRights };
