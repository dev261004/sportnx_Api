import { Router } from "express";
import {
  createOrderController,
  verifyPaymentController,
  refundPaymentController
} from "./paymentController";
import decryptRequestBody from "../../common/midlewares/decryptRequestBody";

const router = Router();

router.post("/create-order", decryptRequestBody, createOrderController);

router.post("/verify-payment", decryptRequestBody, verifyPaymentController);

router.post("/refund", decryptRequestBody, refundPaymentController);


export default router;
