import express from "express";
import sportsController from "./sportsController";
import sportsValidation from "./sportsValidation";
import validation from "../../common/midlewares/validation";
import methodNotAllowed from "../../common/utils/methodNotFound";
import decryptRequestBody from "../../common/midlewares/decryptRequestBody";

const router = express.Router();

router
  .route("/set-sports")
  .patch(
    decryptRequestBody,
    validation(sportsValidation.setSports),
    sportsController.setSports
  )
  .all(methodNotAllowed);
router
  .route("/list")
  .get(sportsController.getActiveSports)
  .all(methodNotAllowed);
router
  .route("/set-location")
  .patch(
    decryptRequestBody,
    validation(sportsValidation.setLocation),
    sportsController.setLocation
  )
  .all(methodNotAllowed);

export default router;
