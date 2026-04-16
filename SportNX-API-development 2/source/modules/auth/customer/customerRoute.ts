import express from "express";
import validation from "../../../common/midlewares/validation";
import customerValidation from "../customer/customerValidation";
import methodNotAllowed from "../../../common/utils/methodNotFound";
import customerController from "./customerController";
import decryptRequestBody from "../../../common/midlewares/decryptRequestBody";
// import auth from "../../../common/midlewares/auth";

const router = express.Router();

router
  .route("/auth/login")
  .post(
    decryptRequestBody,
    validation(customerValidation.login),
    customerController.login
  )
  .all(methodNotAllowed);
router
  .route("/auth/verifyOTP")
  .post(
    decryptRequestBody,
    validation(customerValidation.verifyOTP),
    customerController.verifyOTP
  )
  .all(methodNotAllowed);
router
  .route("/auth/onboard")
  .post(
    decryptRequestBody,
    validation(customerValidation.onboard),
    customerController.onboard
  )
  .all(methodNotAllowed);
router
  .route("/auth/resendOTP")
  .post(
    decryptRequestBody,
    validation(customerValidation.resendOTP),
    customerController.resendOTP
  )
  .all(methodNotAllowed);

router
  .route("/edit-profile")
  .patch(
    decryptRequestBody,
    validation(customerValidation.editUserProfile),
    customerController.editUserProfile
  )
  .all(methodNotAllowed);

// router
// .route("/deleteUser")
// .delete(
//   auth("deleteUser"),
//   validation(customerValidation.deleteUser),
//   customerController.deleteUser
// )
// .all(methodNotAllowed);

export default router;
