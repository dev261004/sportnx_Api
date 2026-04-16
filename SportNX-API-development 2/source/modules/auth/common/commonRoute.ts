import express from "express";
import decryptRequestBody from "../../../common/midlewares/decryptRequestBody";
import validation from "../../../common/midlewares/validation";
import commonValidation from "./commonValidation";
import commonController from "./commonController";
import methodNotAllowed from "../../../common/utils/methodNotFound";
import auth from "../../../common/midlewares/auth";
// import upload from "../../s../common/utils/fileUpload";

const router = express.Router();

router
  .route("/auth/refresh-token")
  .post(
    decryptRequestBody,
    validation(commonValidation.refreshToken),
    commonController.refreshToken
  )
  .all(methodNotAllowed);

router
  .route("/auth/logout")
  .post(
    auth("logout"),
    decryptRequestBody,
    validation(commonValidation.logout),
    commonController.logout
  )
  .all(methodNotAllowed);

router.route("/image-upload").post(commonController.imageUpload);

router
  .route("/image-deleted")
  .post(validation(commonValidation.imageDelete), commonController.imageDelete);

export default router;
