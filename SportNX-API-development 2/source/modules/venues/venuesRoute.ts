import express from "express";
import venuesController from "./venuesController";
import methodNotAllowed from "../../common/utils/methodNotFound";
import validation from "../../common/midlewares/validation";
import venuesValidation from "./venuesValidation";
import decryptRequestBody from "../../common/midlewares/decryptRequestBody";
import auth from "../../common/midlewares/auth";

const router = express.Router();

router.route("/cities").get(venuesController.getCityList).all(methodNotAllowed);

router
  .route("/list")
  .get(validation(venuesValidation.venuesList), venuesController.venuesList)
  .all(methodNotAllowed);

router
  .route("/hompage-list")
  .get(
    validation(venuesValidation.venuesHomepageList),
    venuesController.venuesHomepageList
  )
  .all(methodNotAllowed);

router
  .route("/default-price")
  .patch(
    auth("updateBoxPrice"),
    decryptRequestBody,
    validation(venuesValidation.fixedPrice),
    venuesController.fixedPrice
  )
  .all(methodNotAllowed);

router
  .route("/venue-timing")
  .post(
    auth("updateVenueTiming"),
    decryptRequestBody,
    validation(venuesValidation.addVenueTiming),
    venuesController.addVenueTiming
  )
  .all(methodNotAllowed);

router
  .route("/update-price")
  .patch(
    auth("updateBoxVariablePrice"),
    decryptRequestBody,
    validation(venuesValidation.updateSlotPricesSchema),
    venuesController.updateSlotPrices
  );

router
  .route("/find-venues")
  .get(validation(venuesValidation.findVenues), venuesController.findVenues)
  .all(methodNotAllowed);

router
  .route("/detail")
  .get(validation(venuesValidation.venueDetail), venuesController.venueDetail)
  .all(methodNotAllowed);

router
  .route("/details/:venueId")
  .get(
    auth("getVenueDetail"),
    validation(venuesValidation.getVenueDetail),
    venuesController.getVenueDetail
  )
  .all(methodNotAllowed);

router
  .route("/box-detail/:boxId")
  .get(
    auth("getBoxDetails"),
    validation(venuesValidation.getBoxDetail),
    venuesController.getBoxDetail
  )
  .all(methodNotAllowed);

router
  .route("/:venueId/images")
  .get(
    validation(venuesValidation.getVenueImages),
    venuesController.getVenueImages
  )
  .all(methodNotAllowed);

router
  .route("/getVenuesList")
  .get(
    validation(venuesValidation.gerVenuesListBySearch),
    venuesController.gerVenuesListBySearch
  )
  .all(methodNotAllowed);

router
  .route("/getOwnerVenueList")
  .get(
    auth("getOwnerVenueList"),
    validation(venuesValidation.getOwnerVenueList),
    venuesController.getOwnerVenueList
).all(methodNotAllowed);

export default router;
