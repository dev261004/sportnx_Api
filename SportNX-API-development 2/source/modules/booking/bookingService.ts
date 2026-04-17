import CustomAppError, { handleError } from "../../common/utils/appError";
import { getModuleVersion } from "../../common/utils/getModuleVersion";
import { StatusCodes } from "http-status-codes";
import Venues from "../../database/models/venues";
import Boxes from "../../database/models/boxes";
import {
  // BookingAttributes,
  BookingPayload,
  // BookingRow,
  ListSlotsQuery,
  ListSlotsUserQuery,
  SlotPrice,
  SlotsTime,
  SlotsTimeUser,
  userBookingList,
  VenueTiming,
} from "../../common/utils/types";
import moment from "moment";
import Bookings from "../../database/models/bookings";
import { Op, Transaction } from "sequelize";
import { Request } from "express";
import constant from "../../common/config/constant";
import { groupSlots } from "../../common/utils/helper";
import BoxSportMapping from "../../database/models/box_sport_mapping";
import Sports from "../../database/models/sports";
import calculateDuration from "../../common/utils/calculateDuration";
import Customer from "../../database/models/customer";
import logger from "../../common/config/logger";
import { sequelize } from "../../database/sequelize"; 
const version = getModuleVersion("booking");

const getBookingDateKey = (bookingDate: unknown): string => {
  if (typeof bookingDate === "string") {
    return bookingDate.split("T")[0];
  }
  return moment(bookingDate as string | Date).format("YYYY-MM-DD");
};

const listAvailableSlots = async (query: ListSlotsQuery, req: Request) => {
  try {
    const { venueId, boxId } = query;

    const venue = await Venues.findOne({
      where: { id: venueId },
      attributes: ["id", "venueTiming"],
    });

    if (!venue) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.venue_not_found")
      );
    }

    const venueTiming: VenueTiming[] = Array.isArray(venue?.venueTiming)
      ? venue.venueTiming
      : [];

    const box = await Boxes.findOne({
      where: { id: boxId, venueId: venue.id },
      attributes: ["id", "boxName"],
    });

    if (!box) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.Box_not_found")
      );
    }

    const boxSportMappings = await BoxSportMapping.findAll({
      where: { boxId },
      attributes: ["sportId", "defaultPrice", "timeSlotPrices"],
    });

    const uniqueSportIds = [...new Set(boxSportMappings.map((m) => m.sportId))];
    const sports = await Sports.findAll({
      where: { id: { [Op.in]: uniqueSportIds } },
      attributes: ["id", "sportName"],
    });
    const sportMap = new Map(sports.map((s) => [s.id, s.sportName]));

    const startDate = moment().startOf("day");
    const endDate = moment().add(59, "days").endOf("day");
    const bookingsInRange = await Bookings.findAll({
      where: {
        boxId,
        venueId: venue.id,
        bookingDate: {
          [Op.between]: [startDate.toDate(), endDate.toDate()],
        },
        bookingStatus: {
          [Op.notIn]: [
            constant.BOOKING_STATUS.CANCELLED,
            constant.BOOKING_STATUS.EXPIRED,
          ],
        },
      },
      attributes: [
        "id",
        "startTime",
        "endTime",
        "bookingDate",
        "bookingStatus",
      ],
    });

    const bookingsByDate = new Map<string, typeof bookingsInRange>();
    for (const booking of bookingsInRange) {
      const key = getBookingDateKey(booking.bookingDate);
      if (!bookingsByDate.has(key)) bookingsByDate.set(key, []);
      bookingsByDate.get(key)!.push(booking);
    }

    const mergedSlotsByDate = new Map<
      string,
      { date: string; slots: SlotsTime[] }
    >();

    for (const mapping of boxSportMappings) {
      const sportId = mapping.sportId;
      const sportName = sportMap.get(sportId) || "Unknown Sport";
      const slotPrices: SlotPrice[] = Array.isArray(mapping.timeSlotPrices)
        ? (mapping.timeSlotPrices as SlotPrice[])
        : [];
      const defaultPrice = mapping.defaultPrice ?? null;

      for (
        let date = startDate.clone();
        date.isSameOrBefore(endDate);
        date.add(1, "day")
      ) {
        const dayOfWeek = date.format("dddd");
        const currentDate = date.format("YYYY-MM-DD");
        const timingForDay = venueTiming.find((t) => t.day === dayOfWeek);
        const slotPriceForDay = slotPrices.find((s) => s.day === dayOfWeek);
        const bookingsForDate = bookingsByDate.get(currentDate) || [];

        if (
          timingForDay &&
          timingForDay.open !== null &&
          timingForDay.close !== null &&
          slotPriceForDay &&
          Array.isArray(slotPriceForDay.slots)
        ) {
          for (const slot of slotPriceForDay.slots) {
            // slot start/end with midnight normalization
            const slotStart = moment(
              `${currentDate} ${slot.startTime}`,
              "YYYY-MM-DD HH:mm:ss"
            );
            const slotEnd = moment(
              `${currentDate} ${slot.endTime}`,
              "YYYY-MM-DD HH:mm:ss"
            );
            if (slotEnd.isBefore(slotStart)) {
              slotEnd.add(1, "day");
            }

            const isBooked = bookingsForDate.some((b) => {
              // skip cancelled bookings
              if (b.bookingStatus === "cancelled") return false;

              // booking start/end with midnight normalization
              const bookingStart = moment(
                `${currentDate} ${b.startTime}`,
                "YYYY-MM-DD HH:mm:ss"
              );
              const bookingEnd = moment(
                `${currentDate} ${b.endTime}`,
                "YYYY-MM-DD HH:mm:ss"
              );
              if (bookingEnd.isBefore(bookingStart)) {
                bookingEnd.add(1, "day");
              }

              // future check (based on full datetime, not just day)
              // const isFuture = bookingStart.isAfter(moment());
              // logger.info("Booking check: ", {
              //   bookingStart: bookingStart.format(),
              //   bookingEnd: bookingEnd.format(),
              //   isFuture,
              // });

              // Overlap check
              return (
                slotStart.isBefore(bookingEnd) && slotEnd.isAfter(bookingStart)
              );
            });

            if (!mergedSlotsByDate.has(currentDate)) {
              mergedSlotsByDate.set(currentDate, {
                date: currentDate,
                slots: [],
              });
            }

            const daySlots = mergedSlotsByDate.get(currentDate)!.slots;
            let existingSlot = daySlots.find(
              (s) =>
                s.startTime === slot.startTime && s.endTime === slot.endTime
            );
            if (!existingSlot) {
              existingSlot = {
                startTime: slot.startTime,
                endTime: slot.endTime,
                isBooked,
                prices: [],
              };
              daySlots.push(existingSlot);
            }

            existingSlot.prices.push({
              sportId,
              sportName,
              price: slot.price || defaultPrice || null,
              gst: slot.gst || null,
            });

            if (isBooked) existingSlot.isBooked = true;
          }
        }

        if (!mergedSlotsByDate.has(currentDate)) {
          mergedSlotsByDate.set(currentDate, { date: currentDate, slots: [] });
        }
      }
    }

    return Array.from(mergedSlotsByDate.values());
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

const listBoxesForVenue = async (venueId: string, req: Request) => {
  try {
    const venue = await Venues.findOne({
      where: { id: venueId },
      attributes: ["id", "venueTiming"],
    });

    if (!venue) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.venue_not_found")
      );
    }

    const boxes = await Boxes.findAll({
      where: { venueId: venue.id },
      attributes: ["id", "boxName"],
    });

    if (!boxes.length) return [];

    const mappings = await BoxSportMapping.findAll({
      where: { boxId: { [Op.in]: boxes.map((b) => b.id) } },
      attributes: ["boxId", "defaultPrice"],
    });

    // Group mappings by boxId for quick lookup
    const mappingsByBox = new Map<string, typeof mappings>();
    for (const m of mappings) {
      if (!mappingsByBox.has(m.boxId)) mappingsByBox.set(m.boxId, []);
      mappingsByBox.get(m.boxId)!.push(m);
    }

    const isVenueClosed =
      !venue?.venueTiming ||
      (Array.isArray(venue.venueTiming) &&
        venue.venueTiming.every((day) => !day.open && !day.close));

    // Build final result in-memory
    const result = boxes.map((box) => {
      const boxMappings = mappingsByBox.get(box.id) || [];
      const hasDefaultPrice = boxMappings.some(
        (m) =>
          m.defaultPrice !== null && m.defaultPrice && +m.defaultPrice !== 0
      );

      return {
        id: box.id,
        name: box.boxName ?? "",
        isBoxClose: !hasDefaultPrice,
        isVenueClose: isVenueClosed,
      };
    });

    return result;
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

const createBooking = async (data: BookingPayload, req: Request) => {
   const transaction = await sequelize.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE 
  });
  try {
    const {
      venueId,
      customerId,
      bookingDate,
      boxId,
      sportId,
      slots,
      bookingAmount,
      convenienceFees,
      totalAmount,
      paidAmount,
      dueAmount,
      paymentStatus,
      customerDetails,
      ownerId,
    } = req.body;


    const [customer, venue, box] = await Promise.all([
      customerId
        ? Customer.findByPk(customerId, { attributes: ["id"],transaction })
        : Promise.resolve(null),
      Venues.findByPk(venueId, { attributes: ["id", "venueTiming"],transaction }),
      Boxes.findByPk(boxId, { attributes: ["id"],transaction }),
    ]);

    if (customerId && !customer) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.userNotFound")
      );
    }

    if (!venue) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.venue_not_found")
      );
    }

    if (!box) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.Box_not_found")
      );
    }

    const sport = await Sports.findByPk(sportId, { attributes: ["id"] });
    if (!sport) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.sport_not_found")
      );
    }
    const grouped = groupSlots(slots);
    if (grouped.length > 1) {
      throw new CustomAppError(
        StatusCodes.BAD_REQUEST,
        req.t("errorMessages.slot_continuous")
      );
    }

    const slotGroup = grouped[0];
    const currentTime = new Date().toTimeString().split(" ")[0];
    const formattedBookingDate = moment(bookingDate).format("YYYY-MM-DD");
    const formattedToday = moment().format("YYYY-MM-DD");

    if (formattedBookingDate === formattedToday) {
      const slotStartTime = slotGroup[0].startTime;

      if (slotStartTime <= currentTime) {
        throw new CustomAppError(
          StatusCodes.BAD_REQUEST,
          req.t("errorMessages.pastTimeSlot")
        );
      }
    }

    const bookingDay = moment(bookingDate).format("dddd");

    const venueTiming: VenueTiming[] = Array.isArray(venue.venueTiming)
      ? venue.venueTiming
      : typeof venue.venueTiming === "string"
      ? JSON.parse(venue.venueTiming)
      : [];

    const dayTiming = venueTiming.find(
      (v) => v.day.toLowerCase() === bookingDay.toLowerCase()
    );
    if (!dayTiming || !dayTiming.open || !dayTiming.close) {
      throw new CustomAppError(
        StatusCodes.BAD_REQUEST,
        req.t("errorMessages.venueClosedOnThisDay")
      );
    }

    const openTime = moment(dayTiming.open, "HH:mm:ss");
    const closeTime = moment(dayTiming.close, "HH:mm:ss");

    for (const slot of slotGroup) {
      const slotStart = moment(slot.startTime, "HH:mm:ss");
      const slotEnd = moment(slot.endTime, "HH:mm:ss");

      if (slotStart.isBefore(openTime) || slotEnd.isAfter(closeTime)) {
        throw new CustomAppError(
          StatusCodes.BAD_REQUEST,
          req.t("errorMessages.venueClosedOnThisDay")
        );
      }
    }

    const conflictingBooking = await Bookings.findOne({
      where: {
        venueId,
        boxId,
        bookingDate: new Date(bookingDate),
        [Op.and]: [
          {
            startTime: { [Op.lt]: slotGroup[slotGroup.length - 1].endTime },
          },
          {
            endTime: { [Op.gt]: slotGroup[0].startTime },
          },
        ],
        bookingStatus: {
          [Op.ne]: constant.BOOKING_STATUS.CANCELLED,
        },
      },
      transaction,
      lock: true
    });
    logger.info("conflictingBooking:===>", conflictingBooking);
    if (conflictingBooking !== null) {
      throw new CustomAppError(
        StatusCodes.CONFLICT,
        req.t("errorMessages.allReady_selected")
      );
    }

    const slotsBook = await Bookings.create({
      venueId,
      customerId: customerId || null,
      ownerId: ownerId || null,
      boxId,
      sportId,
      bookingDate: new Date(bookingDate),
      startTime: slotGroup[0].startTime,
      endTime: slotGroup[slotGroup.length - 1].endTime,
      slotPrices: slotGroup,
      bookingAmount,
      convenienceFees,
      totalAmount,
      paidAmount,
      dueAmount,
      paymentStatus,
      bookingStatus: constant.BOOKING_STATUS.CONFIRMED,
      customerDetails,
      razorpayPaymentId: "dummy",
      razorpayPaymentMethod: "card",
    },{transaction});

    await transaction.commit();
    return slotsBook;
  }  catch (error: unknown) {
    logger.info("error",error);
    await transaction.rollback();

    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "SequelizeUniqueConstraintError"
    ) {
      throw new CustomAppError(
        StatusCodes.CONFLICT,
        req.t("errorMessages.allReady_selected") 
      );
    }

    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
    throw error;
  }
};

const getBookingList = async (req: Request) => {
  try {
    const { venueId, targetDate, targetBoxId, page } = req.query as {
      venueId?: string;
      targetDate?: string;
      targetBoxId?: string;
      page?: string;
    };

    const pages = (page && parseInt(page as string)) || 1;
    const limit = 5;

    const venuesDetails = await Venues.findByPk(venueId, {
      attributes: ["id", "venueTiming"],
    });
    if (!venuesDetails) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.venue_not_found")
      );
    }

    const venueTiming: VenueTiming[] = Array.isArray(venuesDetails?.venueTiming)
      ? venuesDetails.venueTiming
      : typeof venuesDetails?.venueTiming === "string"
      ? JSON.parse(venuesDetails.venueTiming)
      : [];

    const boxes = await Boxes.findAll({
      where: { venueId },
      attributes: ["id", "boxName"],
    });

    const allBoxMappings = await BoxSportMapping.findAll({
      where: {
        boxId: boxes.map((box) => box.id),
      },
      attributes: ["boxId", "defaultPrice"],
    });

    const boxMappingsMap = new Map<
      string,
      Array<{ boxId: string; defaultPrice?: number | undefined }>
    >();
    allBoxMappings.forEach((mapping) => {
      if (!boxMappingsMap.has(mapping.boxId)) {
        boxMappingsMap.set(mapping.boxId, []);
      }
      boxMappingsMap.get(mapping.boxId)!.push(mapping);
    });

    const bookings = await Bookings.findAll({
      where: { venueId,paymentStatus: { [Op.ne]: constant.PAYMENT_STATUS.PENDING } },
      order: [["created_at", "DESC"]],
      attributes: [
        "id",
        "startTime",
        "endTime",
        "totalAmount",
        "dueAmount",
        "paymentStatus",
        "bookingStatus",
        "bookingDate",
        "customerDetails",
        "boxId",
        "refundAmount",
        "paidAmount",
        "cancellationDetails",
        "convenienceFees",
        "created_at",
        "ownerId",
        "bookingAmount",
        "slotPrices",
        "razorpayPaymentId",
      ],
      include: [
        {
          as: "sport",
          model: Sports,
          attributes: ["sportName"],
        },
      ],
    });

    const result = [];
    for (const box of boxes) {
      const mappings = boxMappingsMap.get(box.id) || [];
      const hasDefaultPrice = mappings.some(
        (m: { boxId: string; defaultPrice?: number | undefined }) =>
          m.defaultPrice !== null &&
          m.defaultPrice !== undefined &&
          +m.defaultPrice !== 0
      );
      const isVenueClosed =
        !venuesDetails?.venueTiming ||
        (Array.isArray(venuesDetails.venueTiming) &&
          venuesDetails.venueTiming.every((day) => !day.open && !day.close));
      result.push({
        boxId: box.id,
        boxName: box.boxName ?? "",
        isBoxClose: !hasDefaultPrice,
        isVenuesClose: isVenueClosed,
      });
    }

    if (!bookings.length) return result;

    const bookingDates = bookings
      .map((b) => b.bookingDate)
      .filter((d): d is NonNullable<typeof d> => d != null)
      .map((d) => new Date(d));

    const startDate = new Date(
      Math.min(...bookingDates.map((d: Date) => d.getTime()))
    );
    const endDate = new Date(
      Math.max(...bookingDates.map((d: Date) => d.getTime()))
    );

    const allDates: string[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      allDates.push(currentDate.toISOString().split("T")[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const response = await Promise.all(
      boxes.map(async (box) => {
        const boxBookingsByDate = allDates.map((formattedDate) => {
          const dayName = new Date(formattedDate).toLocaleString("en-US", {
            weekday: "long",
          });
          const timing = venueTiming.find(
            (v: { day: string }) => v.day === dayName
          );
          const isClosed = !timing?.open && !timing?.close;

          const isTarget =
            targetDate === formattedDate && targetBoxId === box.id;

          let filteredBookings = bookings.filter(
            (b) =>
              b.boxId === box.id &&
              b.bookingDate &&
              new Date(b.bookingDate).toISOString().split("T")[0] ===
                formattedDate
          );

          const allBookingsForDate = bookings.filter(
            (b) =>
              b.boxId === box.id &&
              b.bookingDate &&
              new Date(b.bookingDate).toISOString().split("T")[0] ===
                formattedDate
          );

          const totalBookings = allBookingsForDate.length;

          if (isTarget) {
            const offset = (pages - 1) * limit;
            filteredBookings = filteredBookings.slice(offset, offset + limit);
          } else {
            filteredBookings = filteredBookings.slice(0, limit);
          }

          const bookingsForDate = filteredBookings.map((b) => ({
            customerName: b.customerDetails?.name ?? "",
            phone: b.customerDetails?.phone ?? "-",
            startTime: b.startTime,
            endTime: b.endTime,
            sportName: b.sport?.sportName ?? "-",
            duration: calculateDuration(b.startTime, b.endTime),
            convenienceFees: b.convenienceFees,
            totalAmount: Number(b.totalAmount ?? 0),
            remainingAmount: Number(b.dueAmount ?? 0),
            paymentStatus: b.paymentStatus ?? "-",
            bookingStatus: b.bookingStatus ?? "-",
            refundAmount: b.refundAmount ?? 0,
            paidAmount: b.paidAmount ?? 0,
            bookingId: b.id,
            cancellationDetails: b.cancellationDetails,
            bookingDate: b.created_at,
            ownerId: b.ownerId,
            slotTime: b.slotPrices,
            razorPayId: b.razorpayPaymentId,
            bookingAmount: b.bookingAmount,
          }));

          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const dateObj = new Date(formattedDate);
          dateObj.setHours(0, 0, 0, 0);

          const isPastDate = dateObj < today;

          return {
            date: formattedDate,
            isClosed: isPastDate ? false : isClosed,
            totalBookings,
            currentPage: targetDate === formattedDate ? pages : 1,
            totalPage: Math.ceil(totalBookings / limit),
            bookings: bookingsForDate,
          };
        });

        // ✅ Use the lookup map here too instead of another database query
        const mappings = boxMappingsMap.get(box.id) || [];

        const hasDefaultPrice = mappings.some(
          (m: { boxId: string; defaultPrice?: number | undefined }) =>
            m.defaultPrice !== null &&
            m.defaultPrice !== undefined &&
            +m.defaultPrice !== 0
        );
        const isVenueClosed =
          !venuesDetails?.venueTiming ||
          (Array.isArray(venuesDetails.venueTiming) &&
            venuesDetails.venueTiming.every((day) => !day.open && !day.close));
        return {
          boxId: box.id,
          boxName: box.boxName,
          isBoxClose: !hasDefaultPrice,
          isVenuesClose: isVenueClosed,
          boxes: boxBookingsByDate,
        };
      })
    );

    return response;
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

const markBookingAsPaid = async (req: Request) => {
  try {
    const bookingId = req.body.bookingId as string;
    const booking = await Bookings.findByPk(bookingId, {
      attributes: [
        "id",
        "startTime",
        "endTime",
        "totalAmount",
        "dueAmount",
        "paymentStatus",
        "bookingStatus",
        "bookingDate",
        "customerDetails",
        "boxId",
        "refundAmount",
        "paidAmount",
        "cancellationDetails",
        "created_at",
      ],
    });

    if (!booking) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.booking_not_found")
      );
    }

    const totalAmount = Number(booking.totalAmount || 0);

    await booking.update({
      paidAmount: totalAmount,
      dueAmount: 0,
      paymentStatus: constant.PAYMENT_STATUS.FULL_PAID,
    });

    return booking;
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

const cancellationBooking = async (req: Request) => {
  const transaction = await sequelize.transaction();
  try {
    const { bookingId, refundAmount } = req.body;
    const booking = await Bookings.findByPk(bookingId, {
      attributes: [
        "id",
        "startTime",
        "endTime",
        "totalAmount",
        "dueAmount",
        "paymentStatus",
        "bookingStatus",
        "bookingDate",
        "customerDetails",
        "boxId",
        "refundAmount",
        "paidAmount",
        "cancellationDetails",
        "created_at",
      ],
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!booking) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.booking_not_found")
      );
    }
    // ✅ Already cancelled check
    if (booking.bookingStatus === constant.BOOKING_STATUS.CANCELLED) {
      throw new CustomAppError(
        StatusCodes.BAD_REQUEST,
        req.t("errorMessages.booking_already_cancelled")
      );
    }
    if (refundAmount > (booking.paidAmount ?? 0)) {
      throw new CustomAppError(
        StatusCodes.BAD_REQUEST,
        req.t("errorMessages.refund_more_than_paid")
      );
    }
    const cancellationDetails = {
      cancellationTimeStamp: new Date(),
    };
    await booking.update({
      bookingStatus: constant.BOOKING_STATUS.CANCELLED,
      cancellationDetails,
      refundAmount,
    }, { transaction });

    await transaction.commit();
    return booking;
  } catch (error: unknown) {
    await transaction.rollback();

    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).name === "SequelizeTimeoutError"
    ) {
      throw new CustomAppError(
        StatusCodes.CONFLICT,
        "Booking is being updated by another admin. Try again."
      );
    }

    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

const listAvailableSlotsUser = async (
  query: ListSlotsUserQuery,
  req: Request
) => {
  try {
    const { venueId, sportId } = query;
  

    // 1. Venue
    const venue = await Venues.findOne({
      where: { id: venueId },
      attributes: ["id", "venueTiming", "aboutVenue", "policy", "venueName"],
    });
    if (!venue)
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.venue_not_found")
      );

    const venueTiming: VenueTiming[] = Array.isArray(venue.venueTiming)
      ? venue.venueTiming
      : [];

    // 2. Boxes
    const boxes = await Boxes.findAll({
      where: { venueId: venue.id },
      attributes: ["id", "boxName"],
    });
    if (!boxes.length)
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.no_boxes_found")
      );

    const boxIds = boxes.map((b) => b.id);

    // 3. Box-sport mappings

    const whereCondition: { boxId: { [Op.in]: string[] }; sportId?: string; defaultPrice?: { [Op.ne]: number } } = {
      boxId: { [Op.in]: boxIds },
      defaultPrice: {[Op.ne]: 0}
    };
    if (sportId) whereCondition.sportId = sportId;

    const boxSportMappings = await BoxSportMapping.findAll({
      where: whereCondition,
      attributes: ["boxId", "sportId", "defaultPrice", "timeSlotPrices"],
    });


    // ✅ Pre-group mappings by boxId
    const mappingsByBox = new Map<string, typeof boxSportMappings>();
    for (const m of boxSportMappings) {
      if (!mappingsByBox.has(m.boxId)) mappingsByBox.set(m.boxId, []);
      mappingsByBox.get(m.boxId)!.push(m);
    }

    // 4. Sports lookup
    const uniqueSportIds = [...new Set(boxSportMappings.map((m) => m.sportId))];
    const sports = await Sports.findAll({
      where: { id: { [Op.in]: uniqueSportIds } },
      attributes: ["id", "sportName"],
    });
    const sportMap = new Map(sports.map((s) => [s.id, s.sportName]));

    // 5. Bookings (all at once)
    const startDate = moment().startOf("day");
    const endDate = moment().add(59, "days").endOf("day");

    const bookings = await Bookings.findAll({
      where: {
        boxId: { [Op.in]: boxIds },
        venueId: venue.id,
        bookingDate: { [Op.between]: [startDate.toDate(), endDate.toDate()] },
        bookingStatus: {
          [Op.notIn]: [
            constant.BOOKING_STATUS.CANCELLED,
            constant.BOOKING_STATUS.EXPIRED,
          ],
        },
      },
      attributes: ["id", "boxId", "startTime", "endTime", "bookingDate","bookingStatus"],
    });

    // ✅ Pre-group bookings by (boxId + date)
    const bookingsByBoxAndDate = new Map<string, typeof bookings>();
    for (const b of bookings) {
      const key = `${b.boxId}-${getBookingDateKey(b.bookingDate)}`;
      if (!bookingsByBoxAndDate.has(key)) bookingsByBoxAndDate.set(key, []);
      bookingsByBoxAndDate.get(key)!.push(b);
    }

    // 6. Build slots
    const slotsByDate = new Map<string, Map<string, SlotsTimeUser>>();

    for (const box of boxes) {
      const boxMappings = mappingsByBox.get(box.id) || [];

      for (const mapping of boxMappings) {
        const sportName = sportMap.get(mapping.sportId) || "Unknown Sport";
        const slotPrices: SlotPrice[] = Array.isArray(mapping.timeSlotPrices)
          ? (mapping.timeSlotPrices as SlotPrice[])
          : [];
        const defaultPrice = mapping.defaultPrice ?? null;

        for (
          let date = startDate.clone();
          date.isSameOrBefore(endDate);
          date.add(1, "day")
        ) {
          const day = date.format("dddd");
          const currentDate = date.format("YYYY-MM-DD");
          const timing = venueTiming.find((t) => t.day === day);
          const slotPriceForDay = slotPrices.find((s) => s.day === day);

          if (!timing || !timing.open || !timing.close) continue;
          if (!slotPriceForDay || !Array.isArray(slotPriceForDay.slots))
            continue;

          // Ensure day initialized
          if (!slotsByDate.has(currentDate)) {
            slotsByDate.set(currentDate, new Map());
          }
          const dateSlots = slotsByDate.get(currentDate)!;

          const bookingsForDate =
            bookingsByBoxAndDate.get(`${box.id}-${currentDate}`) || [];

          for (const slot of slotPriceForDay.slots) {
            const slotKey = `${slot.startTime}-${slot.endTime}`;
            if (!dateSlots.has(slotKey)) {
              dateSlots.set(slotKey, {
                startTime: slot.startTime,
                endTime: slot.endTime,
                prices: [],
              });
            }

            const slotEntry = dateSlots.get(slotKey)!;

            // booking overlap check
            const slotStart = moment(`${currentDate} ${slot.startTime}`);
            const slotEnd = moment(`${currentDate} ${slot.endTime}`);
            const isBooked = bookingsForDate.some((b) => {
              if (b.bookingStatus === "cancelled") return false;

              const bookingStart = moment(`${currentDate} ${b.startTime}`);
              const bookingEnd = moment(`${currentDate} ${b.endTime}`);
              return (
                slotStart.isBefore(bookingEnd) && slotEnd.isAfter(bookingStart)
              );
            });

            slotEntry.prices.push({
              sportId: mapping.sportId,
              sportName,
              price: slot.price || defaultPrice,
              gst: slot.gst || null,
              isBooked,
              boxId: box.id,
              boxName: box.boxName ?? "",
            });
          }
        }
      }
    }

    // 7. Final output
    const days = Array.from(slotsByDate.entries())
      .map(([date, slots]) => ({
        date,
        slots: Array.from(slots.values()).sort((a, b) =>
          a.startTime.localeCompare(b.startTime)
        ),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      days,
      venueName: venue.venueName,
      aboutVenue: venue.aboutVenue,
      policy: venue.policy,
      boxList: boxes.map((b) => ({ id: b.id, name: b.boxName ?? "" })),
    };
  } catch (error: unknown) {
    handleError(error, { req, version, priority: constant.PRIORITY.LOW });
  }
};

// const getUserBookingList = async (req: Request) => {
//   try {
//     const { page, phone } = req.query as { page?: string; phone?: string };

//     const pages = (page && parseInt(page)) || 1;
//     const limit = 5;
//     const offset = (pages - 1) * limit;

//     // ✅ Build where condition
//     const orConditions: WhereAttributeHash<BookingAttributes>[] = [];
//     if (req.user?.id) {
//       orConditions.push({ customerId: req.user.id });
//     }

//     if (phone) {
//       const formattedPhone = phone.startsWith("+91") ? phone : `+91${phone}`;
//       orConditions.push({ customerDetails: { phone: formattedPhone } });
//     }

//     const where: WhereOptions<BookingAttributes> = orConditions.length
//       ? { [Op.or]: orConditions }
//       : {};

//     const { rows, count: total } = await Bookings.findAndCountAll({
//       where,
//       offset,
//       limit,
//       order: [["created_at", "DESC"]],
//       attributes: [
//         "id",
//         "startTime",
//         "endTime",
//         "totalAmount",
//         "dueAmount",
//         "paymentStatus",
//         "bookingStatus",
//         "bookingDate",
//         "customerDetails",
//         "refundAmount",
//         "paidAmount",
//         "cancellationDetails",
//         "created_at",
//         "ownerId",
//         "bookingAmount",
//         "slotPrices",
//         "razorpayPaymentId",
//       ],
//       include: [
//         {
//           model: Venues,
//           as: "bookingVenue",
//           attributes: ["id", "venueName", "city", "address"],
//         },
//         { model: Boxes, as: "box", attributes: ["id", "boxName", "image"] },
//         { model: Sports, as: "sport", attributes: ["sportName"] },
//       ],
//     });

//     const bookings = rows as BookingRow[];

//     const data = bookings.map((b) => ({
//       bookingId: b.id,
//       bookingDate: b.bookingDate,
//       startTime: b.startTime,
//       endTime: b.endTime,
//       bookingStatus: b.bookingStatus,
//       paymentStatus: b.paymentStatus,
//       totalAmount: Number(b.totalAmount ?? 0),
//       dueAmount: Number(b.dueAmount ?? 0),
//       paidAmount: Number(b.paidAmount ?? 0),
//       refundAmount: Number(b.refundAmount ?? 0),
//       slotPrices: b.slotPrices,
//       razorPayId: b.razorpayPaymentId,
//       bookingAmount: b.bookingAmount,
//       cancellationDetails: b.cancellationDetails,
//       createdAt: b.created_at,

//       customerName: b.customerDetails?.name ?? "",
//       phone: b.customerDetails?.phone ?? "-",

//       venue: {
//         id: b.bookingVenue?.id,
//         name: b.bookingVenue?.venueName,
//         city: b.bookingVenue?.city,
//         address: b.bookingVenue?.address,
//       },
//       box: {
//         id: b.box?.id,
//         name: b.box?.boxName,
//         image: b.box?.image ?? null,
//       },
//       sportName: b.sport?.sportName ?? "-",
//     }));

//     return {
//       data,
//       pagination: {
//         currentPage: pages,
//         totalPage: Math.ceil(total / limit),
//         totalRecords: total,
//       },
//     };
//   } catch (error: unknown) {
//     handleError(error, {
//       req,
//       version: "v1",
//       priority: constant.PRIORITY.LOW,
//     });
//   }
// };
const addUserBooking = async (req: Request) => {
  const transaction = await sequelize.transaction();

  try {
    logger.info("Adding user booking...", req.body);

    const {
      venueId,
      boxId,
      sportId,
      paymentStatus,
      bookingDate,
      slots,
    } = req.body;


    const [venue, box, sport] = await Promise.all([
      Venues.findByPk(venueId, {
        attributes: ["id", "venueTiming"],
        transaction,
      }),
      Boxes.findByPk(boxId, {
        attributes: ["id"],
        transaction,
      }),
      Sports.findByPk(sportId, {
        attributes: ["id"],
        transaction,
      }),
    ]);

    if (!venue) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.venue_not_found")
      );
    }

    if (!box) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.Box_not_found")
      );
    }

    if (!sport) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.sport_not_found")
      );
    }

    const grouped = groupSlots(slots);

    if (grouped.length !== 1) {
      throw new CustomAppError(
        StatusCodes.BAD_REQUEST,
        req.t("errorMessages.slot_continuous")
      );
    }

    const slotGroup = grouped[0];

    const bookingDateStr = moment(bookingDate).format("YYYY-MM-DD");
    const todayStr = moment().format("YYYY-MM-DD");
    const currentTime = moment().format("HH:mm:ss");

    if (bookingDateStr === todayStr) {
      if (slotGroup[0].startTime <= currentTime) {
        throw new CustomAppError(
          StatusCodes.BAD_REQUEST,
          req.t("errorMessages.pastTimeSlot")
        );
      }
    }

    const bookingDay = moment(bookingDate).format("dddd");

    const venueTiming: VenueTiming[] = Array.isArray(venue.venueTiming)
      ? venue.venueTiming
      : JSON.parse(venue.venueTiming || "[]");

    const dayTiming = venueTiming.find(
      (v) => v.day.toLowerCase() === bookingDay.toLowerCase()
    );

    if (!dayTiming?.open || !dayTiming?.close) {
      throw new CustomAppError(
        StatusCodes.BAD_REQUEST,
        req.t("errorMessages.venueClosedOnThisDay")
      );
    }

    const openTime = moment(dayTiming.open, "HH:mm:ss");
    const closeTime = moment(dayTiming.close, "HH:mm:ss");

    for (const slot of slotGroup) {
      const start = moment(slot.startTime, "HH:mm:ss");
      const end = moment(slot.endTime, "HH:mm:ss");

      if (start.isBefore(openTime) || end.isAfter(closeTime)) {
        throw new CustomAppError(
          StatusCodes.BAD_REQUEST,
          req.t("errorMessages.venueClosedOnThisDay")
        );
      }
    }


    const startTime = slotGroup[0].startTime;
    const endTime = slotGroup[slotGroup.length - 1].endTime;
const formattedDate = new Date(bookingDate)
  .toISOString()
  .split("T")[0];
const bookingTsrange = sequelize.literal(`
  tstzrange(
    ('${formattedDate}'::date + '${startTime}'::time)::timestamptz,
    ('${formattedDate}'::date + '${endTime}'::time)::timestamptz,
    '[)'
  )
`);


    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const booking = await Bookings.create(
      {
        venueId,
        boxId,
        sportId,
        bookingDate: new Date(bookingDate),
        startTime,
        endTime,
        bookingTsrange,
        slotPrices: slotGroup,
        paymentStatus,
        expiresAt,
      },
      { transaction }
    );

    await transaction.commit();
    return { id: booking.id };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    await transaction.rollback();

    /* -------- Exclusion constraint violation -------- */
    if (error?.original?.code === "23P01") {
      throw new CustomAppError(
        StatusCodes.CONFLICT,
        req.t("errorMessages.allReady_selected")
      );
    }

    logger.error("Error adding user booking:", error);

    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });

    throw error;
  }
};

const userBookingList = async (query:userBookingList,req:Request)=>{
  try {
    const { customerId, page, limit } = query;
    logger.info("query",query);

    const user = await Customer.findByPk(customerId,{ attributes: ["id","full_name"] });

     if(!user){
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.userNotFound")
      );
    }

    const bookings = await Bookings.findAll({
      where: { customerId:customerId},
      order: [["created_at", "DESC"]],
      attributes: [
        "id",
        "bookingDate",
        "startTime",
        "endTime",
        "totalAmount",
        "slotPrices",
        "bookingAmount",
        "paidAmount",
        "dueAmount",
        "refundAmount",
        "convenienceFees",
        "bookingStatus",
        "cancellationDetails",
        "razorpayPaymentId",
        "created_at"
      ],
      include: [
        {
          as: "sport",
          model: Sports,
          attributes: ["sportName","sportIcon"],
        },
        { 
          as: "bookingVenue",
          model: Venues,
          attributes: ["venueName","location"],
        },
        {
          as:"box",
          model:Boxes,
          attributes:["boxName"]
        }
      ],
    });
    
    if(!bookings){
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.bookingNotFound")
      );
    }

    const pageNum = Number(page) || 1;
    const pageSize = Number(limit) || 5;
    const offset = (pageNum - 1) * pageSize;

    const paginatedBookkings = bookings.slice(offset, offset + pageSize);

    return {userBookingList:paginatedBookkings};


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error:any) {
      handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
    throw error;
  }
};

const deleteUserBooking = async (req: Request) => {
  try {
    const { bookingId } = req.params;

    const normalizedBookingId = Array.isArray(bookingId)
      ? bookingId[0]
      : bookingId;

    if (!normalizedBookingId) {
      throw new CustomAppError(
        StatusCodes.BAD_REQUEST,
        req.t("errorMessages.booking_not_found")
      );
    }

    const booking = await Bookings.findByPk(normalizedBookingId, {
      attributes: ["id"]
    });

    if (!booking) {
      return;
    }

    await booking.destroy();
    return { message: req.t("successMessages.booking_deleted_successfully") };
  }
  catch(error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
    throw error;
  }
};

export default {
  listAvailableSlots,
  listBoxesForVenue,
  createBooking,
  getBookingList,
  markBookingAsPaid,
  cancellationBooking,
  listAvailableSlotsUser,
  // getUserBookingList,
  userBookingList,
  addUserBooking,
  deleteUserBooking
};
