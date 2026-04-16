import express from "express";
import validation from "../../../common/midlewares/validation";
import managerValidation from "./managerValidation";
import methodNotAllowed from "../../../common/utils/methodNotFound";
import managerController from "./managerController";
import decryptRequestBody from "../../../common/midlewares/decryptRequestBody";
import auth from "../../../common/midlewares/auth";

const router = express.Router();

router
  .route("/auth/setPassword")
  .post(
    decryptRequestBody,
    validation(managerValidation.setPassword),
    managerController.setPassword
  )
  .all(methodNotAllowed);

router
  .route("/auth/login")
  .post(
    decryptRequestBody,
    validation(managerValidation.login),
    managerController.login
  )
  .all(methodNotAllowed);

router
  .route("/auth/forgot-password")
  .post(
    decryptRequestBody,
    validation(managerValidation.forgotPassword),
    managerController.forgotPassword
  )
  .all(methodNotAllowed);

router
  .route("/auth/verifyOTP")
  .post(
    decryptRequestBody,
    validation(managerValidation.verifyOTP),
    managerController.verifyOTP
  )
  .all(methodNotAllowed);

router
  .route("/auth/resendOTP")
  .post(
    decryptRequestBody,
    validation(managerValidation.resendOTP),
    managerController.resendOTP
  )
  .all(methodNotAllowed);

router
  .route("/auth/reset-password")
  .post(
    decryptRequestBody,
    validation(managerValidation.resetPassword),
    managerController.resetPassword
  )
  .all(methodNotAllowed);

router
  .route("/auth/change-password")
  .post(
    auth("changesPassword"),
    decryptRequestBody,
    validation(managerValidation.changePassword),
    managerController.changePassword
  )
  .all(methodNotAllowed);

router
  .route("/auth/checkPassword")
  .post(
    decryptRequestBody,
    validation(managerValidation.checkPassword),
    managerController.checkPassword
  )
  .all(methodNotAllowed);

export default router;
