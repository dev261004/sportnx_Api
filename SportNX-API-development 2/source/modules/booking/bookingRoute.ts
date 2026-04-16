import express from "express";
import methodNotAllowed from "../../common/utils/methodNotFound";
import bookingController from "./bookingController";
import validation from "../../common/midlewares/validation";
import bookingValidation from "./bookingValidation";
import auth from "../../common/midlewares/auth";
import decryptRequestBody from "../../common/midlewares/decryptRequestBody";

const router = express.Router();

router
  .route("/slotList")
  .get(
    validation(bookingValidation.listSlotsValidation),
    bookingController.listAvailableSlots
  )
  .all(methodNotAllowed);

router
  .route("/boxes")
  .get(
    auth("listBoxes"),
    validation(bookingValidation.listBoxesValidation),
    bookingController.listBoxesForVenue
  )
  .all(methodNotAllowed);

router
  .route("/addBooking")
  .post(
    decryptRequestBody,
    validation(bookingValidation.createBookingValidation),
    bookingController.createBooking
  )
  .all(methodNotAllowed);

router
  .route("/list")
  .get(
    auth("bookingList"),
    validation(bookingValidation.bookingListValidation),
    bookingController.getBookingList
  )
  .all(methodNotAllowed);

// router
//   .route("/userlist")
//   .get(
//     auth("bookingUserList"),
//     validation(bookingValidation.userBookingListValidation),
//     bookingController.getUserBookingList
//   )
//   .all(methodNotAllowed);

router
  .route("/markAspaid")
  .patch(
    auth("markAsPaid"),
    decryptRequestBody,
    validation(bookingValidation.markPaidValidation),
    bookingController.markAsPaid
  )
  .all(methodNotAllowed);

router
  .route("/cancellationBooking")
  .patch(
    auth("cancellationBooking"),
    decryptRequestBody,
    validation(bookingValidation.cancellationBookingValidation),
    bookingController.cancellationBooking
  )
  .all(methodNotAllowed);

router
  .route("/slotListUser")
  .get(
    validation(bookingValidation.listSlotsUserValidation),
    bookingController.listAvailableSlotsUser
  )
  .all(methodNotAllowed);

router
  .route("/addUserBooking")
  .post(
    decryptRequestBody,
    validation(bookingValidation.addBookingUserValidation),
    bookingController.addUserBooking
  )
  .all(methodNotAllowed);

router
.route("/getUserBooking")
.get(
  auth("userBookingList"),
  validation(bookingValidation.userBookingListValidation),
  bookingController.userBookingList
  )
  .all(methodNotAllowed);

router.route("/deleteUserBooking/:bookingId")
  .delete(
    validation(bookingValidation.deleteUserBookingValidation),
    bookingController.deleteUserBooking
  )
  .all(methodNotAllowed);

export default router;
