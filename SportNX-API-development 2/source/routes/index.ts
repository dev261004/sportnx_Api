import express from "express";
import venues from "../modules/venues/venuesRoute";
import customer from "../modules/auth/customer/customerRoute";
import manager from "../modules/auth/manager/managerRoute";
import common from "../modules/auth/common/commonRoute";
import sports from "../modules/sports/sportsRoute";
import booking from "../modules/booking/bookingRoute";
import payment from "../modules/payment/paymentRoute";

const router = express.Router();

router.use("/venues", venues);
router.use("/api/venues", venues);
router.use("/customer", customer);
router.use("/manager", manager);
router.use("/common", common);
router.use("/sport", sports);
router.use("/booking", booking);
router.use("/payment", payment);

export default router;
