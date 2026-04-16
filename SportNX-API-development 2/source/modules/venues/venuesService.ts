/* eslint-disable @typescript-eslint/no-explicit-any */
import { Sequelize, Op, Includeable, WhereOptions, Order, col, fn, literal } from "sequelize";
import { Request } from "express";
import CustomAppError, { handleError } from "../../common/utils/appError";
import { getModuleVersion } from "../../common/utils/getModuleVersion";
import constant from "../../common/config/constant";
import { models } from "../../database/index";
import {
  BoxWithSportMappings,
  FormattedVenue,
  VenuesHomepageListQuery,
  VenuesListQuery,
  VenueWithBoxes,
  FixedPriceBody,
  DaySlot,
  SlotTimes,
  FindVenuesQuery,
  timeSlotPrices,
  SlotTime,
  venueDetailQuery,
  BoxSportMappingType,
  BoxType,
} from "../../common/utils/types";
import moment from "moment";
import {
  calculateDistance,
  generateSlotsForDay,
} from "../../common/utils/helper";
import { StatusCodes } from "http-status-codes";
import logger from "../../common/config/logger";
import timeToDate from "../../common/utils/dateFormate";
import { BoxSportMappingInstance } from "../../database/models/box_sport_mapping";
import groupSlotsByPrice from "../../common/utils/groupSlotsByPrice";
import mergeContinuousSlots from "../../common/utils/mergeContinuousSlots";
import Business from "../../database/models/businesses";
import unsplashService from "../../common/services/unsplashService";
const version = getModuleVersion("venues");

const { Venues, Boxes, BoxSportMapping, Bookings } = models;
const MAX_DYNAMIC_VENUE_IMAGES = 5;

type UpdatableVenueImageRecord = {
  id: string;
  images?: string[] | null;
  update: (values: { images: string[] }) => Promise<unknown>;
};

const isUsableVenueImage = (image: string | null | undefined): image is string =>
  Boolean(image && image.trim() !== "" && image !== "null" && image !== "undefined");

const normalizeVenueImages = (images: string[] | null | undefined) =>
  [...new Set((images ?? []).filter(isUsableVenueImage))];

const ensureVenueImageCache = async (
  venue: UpdatableVenueImageRecord,
  sportType?: string | null
) => {
  const existingImages = normalizeVenueImages(venue.images);

  if (existingImages.length >= MAX_DYNAMIC_VENUE_IMAGES) {
    return existingImages.slice(0, MAX_DYNAMIC_VENUE_IMAGES);
  }

  if (!sportType) {
    return existingImages;
  }

  const fetchedImages = await unsplashService.getVenueImages(sportType);
  const mergedImages = [
    ...existingImages,
    ...[fetchedImages.primary, ...fetchedImages.gallery].filter(isUsableVenueImage),
  ]
    .filter((image, index, source) => source.indexOf(image) === index)
    .slice(0, MAX_DYNAMIC_VENUE_IMAGES);

  if (mergedImages.length > existingImages.length) {
    await venue.update({ images: mergedImages });
    venue.images = mergedImages;
  }

  return mergedImages;
};
const extractValidImages = (images: any): string[] => {
  if (!images) return [];

  // convert "{a,b,c}" → ["a","b","c"]
  if (typeof images === "string") {
    images = images.replace(/[{}]/g, "").split(",");
  }

  if (!Array.isArray(images)) return [];

  return images.map((img) => img.trim());
};

const getPreferredImage = (images: any): string | null => {
  const cleaned = extractValidImages(images);

  if (cleaned.length === 0) return null;

  // 🥇 Priority 1: Cloudinary
  const cloudinary = cleaned.find((img) =>
    img.includes("res.cloudinary.com")
  );
  if (cloudinary) return cloudinary;

  // 🥈 Priority 2: Unsplash
  const unsplash = cleaned.find((img) =>
    img.includes("images.unsplash.com")
  );
  if (unsplash) return unsplash;

  // 🥉 fallback: first valid
  return cleaned[0] || null;
};

const getCityList = async (req: Request) => {
  try {
    const venues = await Venues.findAll({
      attributes: [
        [
          Sequelize.fn("MIN", Sequelize.cast(Sequelize.col("id"), "text")),
          "id",
        ],
        "city",
        "state",
        "country",
        [Sequelize.fn("MIN", Sequelize.col("latitude")), "latitude"],
        [Sequelize.fn("MIN", Sequelize.col("longitude")), "longitude"],
      ],
      group: ["city", "state", "country"],
      order: [["city", "ASC"]],
      raw: true,
    });

    return venues;
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

const venuesList = async (query: VenuesListQuery, req: Request) => {
  try {
    const {
      city,
      sportId,
      search,
      latitude,
      longitude,
      sortBy,
      date,
      fromTime,
      duration,
      page,
      limit,
      nearest,
    } = query;

    const selectedSport = await models.Sports.findByPk(sportId, {
      attributes: ["sportName"],
    });
    const selectedSportName = selectedSport?.sportName ?? null;

    const cityAndState = city.split(", ");
    const whereClause: WhereOptions = {
      city: cityAndState[0],
      state: cityAndState[1],
    };
    if (search) {
      whereClause.venueName = { [Op.iLike]: `%${search}%` };
    }

    // Distance calculation
    let distanceField: ReturnType<typeof literal> | null = null;
    let order: Order = [];
    if (
      sortBy &&
      (sortBy.toLowerCase() === "asc" || sortBy.toLowerCase() === "desc")
    ) {
      order = [["venueMinPrice", sortBy.toUpperCase()]];
    } else if (nearest === "true" && latitude && longitude) {
      distanceField = literal(`
        6371 * acos(
          cos(radians(${latitude}))
          * cos(radians("latitude"))
          * cos(radians("longitude") - radians(${longitude}))
          + sin(radians(${latitude})) * sin(radians("latitude"))
        )
      `);
      order = [[distanceField, "ASC"]];
    }

    const attributes: (string | [string | ReturnType<typeof fn> | ReturnType<typeof col> | ReturnType<typeof literal>, string])[] = [
      "id",
      "venueName",
      "city",
      "latitude",
      "longitude",
      "images",
      "venueMinPrice",
      "venueMaxPrice",
      "area",
      "isFeatured",
      "venueTiming",
    ];
    if (distanceField) attributes.push([distanceField, "distance"]);

    const pageNum = Number(page) || 1;
    const pageSize = Number(limit) || 10;
    const offset = (pageNum - 1) * pageSize;
    const maxDistance = 25;

    const isAvailabilityFilter = date && fromTime && duration;
    let requestedStart: moment.Moment | undefined;
    let requestedEnd: moment.Moment | undefined;
    if (isAvailabilityFilter) {
      requestedStart = moment(fromTime, "HH:mm");
      requestedEnd = requestedStart.clone().add(Number(duration), "hours");
    }

    // Include boxes and sport mappings
    const boxIncludes: Includeable[] = [
      {
        model: BoxSportMapping,
        as: "sportMappings",
        required: true,
        where: { sport_id: sportId, defaultPrice: { [Op.gt]: 0 } },
        attributes: ["defaultPrice"],
      },
    ];

    // Include bookings to check overlapping
    if (isAvailabilityFilter && requestedStart && requestedEnd) {
      boxIncludes.push({
        model: Bookings,
        as: "bookings",
        required: false,
        where: {
          [Op.and]: [
            Sequelize.literal(
              `DATE("boxes->bookings"."booking_date") = '${date}'`
            ),
            Sequelize.literal(
              `"boxes->bookings"."start_time" < '${requestedEnd.format(
                "HH:mm:ss"
              )}'`
            ),
            Sequelize.literal(
              `"boxes->bookings"."end_time" > '${requestedStart.format(
                "HH:mm:ss"
              )}'`
            ),
          ],
        },
        attributes: ["id", "start_time", "end_time", "booking_date"],
      });
    }

    const { rows: allVenues, count: totalVenues } =
      await Venues.findAndCountAll({
        attributes,
        include: [
          {
            model: Boxes,
            as: "boxes",
            required: true,
            where: { status: "active" },
            attributes: ["id", "boxName"],
            include: boxIncludes,
          },
        ],

        where: {
          [Op.and]: [
            whereClause,
            {
              [Op.or]: [
                { venueMinPrice: { [Op.gt]: 0 } },
                { venueMaxPrice: { [Op.gt]: 0 } },
              ],
            },
            ...(distanceField
              ? [Sequelize.where(distanceField, { [Op.lte]: maxDistance })]
              : []),
          ],
        },

        ...(order.length ? { order } : {}),
        distinct: true,
      });

    if (selectedSportName) {
      await Promise.all(
        allVenues.map((venue) =>
          ensureVenueImageCache(
            venue as unknown as UpdatableVenueImageRecord,
            selectedSportName
          )
        )
      );
    }

    // Filter venues based on venueTiming and bookings
    const filteredVenues = allVenues
      .map((venue) => {
        const v = venue.get({ plain: true }) as unknown as VenueWithBoxes;

        // Step 1: Check venueTiming
        if (isAvailabilityFilter && requestedStart && requestedEnd) {
          const requestedDay = moment(date).format("dddd"); // e.g., "Friday"
          const timingForDay = (v.venueTiming || []).find(
            (t) => t.day === requestedDay
          );

          // If no timing info or open/close is null => closed
          if (!timingForDay || !timingForDay.open || !timingForDay.close) {
            return null; // Venue closed on this day
          }

          const open = moment(timingForDay.open, "HH:mm:ss");
          const close = moment(timingForDay.close, "HH:mm:ss");

          // Requested slot must be within open-close
          if (requestedStart.isBefore(open) || requestedEnd.isAfter(close)) {
            return null;
          }
        }

        // Step 2: Filter boxes with overlapping bookings
        let availableBoxes = v.boxes;
        if (isAvailabilityFilter) {
          availableBoxes = (v.boxes || []).filter(
            (box: BoxWithSportMappings) =>
              !box.bookings || box.bookings.length === 0
          );
        }

        if (!availableBoxes || availableBoxes.length === 0) return null;
        return { ...v, boxes: availableBoxes };
      })
      .filter((v) => v !== null) as VenueWithBoxes[];

    const availableVenuesCount = filteredVenues.length;

    const paginatedVenues = filteredVenues.slice(offset, offset + pageSize);

    // Format response
    let formattedVenues = paginatedVenues.map((v) => {
      const allSportMappings = (v.boxes || []).flatMap(
        (box: BoxWithSportMappings) => box.sportMappings || []
      );
      const defaultPrice =
        allSportMappings.length > 0 ? allSportMappings[0].defaultPrice : null;

      let distance_km: string | null = null;
      if (v.distance) {
        distance_km = Number(v.distance).toFixed(2) + " km";
      } else if (latitude && longitude && v.latitude && v.longitude) {
        distance_km =
          calculateDistance(
            Number(latitude),
            Number(longitude),
            parseFloat(v.latitude.toString()),
            parseFloat(v.longitude.toString())
          ).toString() + " km";
      }

     const image = getPreferredImage(v.images);

      const boxes = v.boxes.map((box) => ({
        box_id: box.id,
        box_name: box.boxName,
      }));

      return {
        id: v.id,
        venue_name: v.venueName,
        city: v.city,
        latitude: v.latitude,
        longitude: v.longitude,
        area: v.area,
        image,
        default_price: defaultPrice,
        min_price: v.venueMinPrice > 0 ? v.venueMinPrice : null,
        max_price: v.venueMaxPrice > 0 ? v.venueMaxPrice : null,
        distance_km,
        boxes,
        isFeatured: v.isFeatured ?? false,
      };
    });

    // Sort by featured if no sortBy or nearest
    if (!sortBy && !nearest) {
      formattedVenues = formattedVenues.sort(
        (a, b) =>
          (b.isFeatured === true ? 1 : 0) - (a.isFeatured === true ? 1 : 0)
      );
    }
  
    return {
      venues: formattedVenues,
      totalVenues,
      availableVenues: isAvailabilityFilter ? availableVenuesCount : 0,
    };
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};
const venuesHomepageList = async (
  query: VenuesHomepageListQuery,
  req: Request
) => {
  const cityAndState = query.city?.split(", ") || [];
  try {
    const sports = await models.Sports.findAll({
      attributes: ["id", "sportName"],
      raw: true,
    });
    const sportNameById = new Map(
      sports.map((sport) => [String(sport.id), sport.sportName ?? ""])
    );

    const venues = await models.Venues.findAll({
      attributes: [
        "id",
        "venueName",
        "city",
        "state",
        "latitude",
        "longitude",
        "images",
        "venueMinPrice",
        "venueMaxPrice",
        "area",
        "isFeatured",
      ],
      include: [
        {
          model: models.Boxes,
          as: "boxes",
          required: true,
          where: { status: "active" },
          attributes: ["id", "boxName"],
          include: [
            {
              model: models.BoxSportMapping,
              as: "sportMappings",
              required: true,
              where:{default_price : {[Op.gt]:0}},
              attributes: ["sportId", "defaultPrice"],
            },
          ],
        },
      ],
      where: {
        ...(query.city
          ? {
              city: { [Op.iLike]: cityAndState[0] },
              state: { [Op.iLike]: cityAndState[1] },
            }
          : {}),
        // ✅ Only include venues where min OR max price is greater than 0
        [Op.or]: [
          { venueMinPrice: { [Op.gt]: 0 } },
          { venueMaxPrice: { [Op.gt]: 0 } },
        ],
      },
    });

    await Promise.all(
      venues.map(async (venue) => {
        const venueData = venue.get({ plain: true }) as unknown as VenueWithBoxes;
        const firstSportId = venueData.boxes
          ?.flatMap((box) => box.sportMappings || [])
          .find((mapping) => Number(mapping.defaultPrice ?? 0) > 0)?.sportId;

        const sportType = firstSportId
          ? sportNameById.get(String(firstSportId)) ?? null
          : null;

        await ensureVenueImageCache(
          venue as unknown as UpdatableVenueImageRecord,
          sportType
        );
      })
    );

    const plainVenues = venues.map((v) =>
      v.get({ plain: true })
    ) as unknown as VenueWithBoxes[];

    const venuesBySport = new Map<
      string,
      { sport_id: string; sport_name: string; venues: FormattedVenue[] }
    >();

    for (const sport of sports) {
      venuesBySport.set(String(sport.id), {
        sport_id: String(sport.id),
        sport_name: sport.sportName ?? "",
        venues: [],
      });
    }

    for (const v of plainVenues) {
      const availableBoxes = v.boxes || [];
      const allSportMappings = availableBoxes.flatMap(
        (box) => box.sportMappings || []
      );

      const sportIds = [
        ...new Set(allSportMappings.map((m) => String(m.sportId))),
      ];
console.log(
  "Venue:",
  v.venueName,
  "Mappings:",
  allSportMappings.map(m => ({
    sportId: m.sportId,
    price: m.defaultPrice
  }))
);
      for (const sportId of sportIds) {
        const defaultPrice =
          allSportMappings.find((m) => String(m.sportId) === sportId)
            ?.defaultPrice ?? null;

        const image = getPreferredImage(v.images);

        const boxes = availableBoxes.map((box) => ({
          box_id: String(box.id),
          box_name: box.boxName,
        }));

        let distance_km: string | null = null;
        if (query.latitude && query.longitude && v.latitude && v.longitude) {
          distance_km =
            calculateDistance(
              Number(query.latitude),
              Number(query.longitude),
              Number(v.latitude),
              Number(v.longitude)
            ).toFixed(2) + " km";
        }

        const formattedVenue: FormattedVenue = {
          id: String(v.id),
          venue_name: v.venueName ?? "",
          city: v.city ?? "",
          area: v.area ?? "",
          image,
          default_price: defaultPrice,
          min_price: v.venueMinPrice > 0 ? v.venueMinPrice : null,
          max_price: v.venueMaxPrice > 0 ? v.venueMaxPrice : null,
          distance_km,
          boxes,
          isFeatured: v.isFeatured ?? false,
          latitude: v.latitude ?? null, // ✅ added
          longitude: v.longitude ?? null, // ✅ added
        };

        const group = venuesBySport.get(sportId);
        if (group) {
          group.venues.push(formattedVenue);
        }
      }
    }

    const result = [...venuesBySport.values()].map((sportGroup) => ({
      ...sportGroup,
      venues: sportGroup.venues.sort(
        (a, b) =>
          (b.isFeatured === true ? 1 : 0) - (a.isFeatured === true ? 1 : 0)
      ),
    }));

    const affordable_sport =
      query.affordable_sport && venuesBySport.has(query.affordable_sport)
        ? [venuesBySport.get(query.affordable_sport)!]
        : [];

    return {
      sports: result,
      affordable_sport,
    };
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

const fixedPrice = async (body: FixedPriceBody, req: Request) => {
  try {
    const { boxId, sportId, price, venueId, gst } = body;
    logger.info("body",body);
    // 🔹 Find mapping for this box & sport
    const boxSportMapping = await models.BoxSportMapping.findOne({
      where: { boxId, sportId },
      attributes: ["id", "defaultPrice", "timeSlotPrices","gst"],
    });

    if (!boxSportMapping) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.boxSportMappingNotFound")
      );
    }

    const oldDefaultPrice = boxSportMapping.defaultPrice ?? 0;

    // 🔹 Get venue & timings
    const venue = await models.Venues.findOne({
      where: { id: venueId },
      attributes: ["id", "venueTiming"],
    });

    if (!venue) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.venue_not_found")
      );
    }

    const venueTimingArr =
      typeof venue.venueTiming === "string"
        ? JSON.parse(venue.venueTiming)
        : venue.venueTiming;

    if (!venueTimingArr) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.addDefaultPrice")
      );
    }

    // 🔹 Prepare updated time slots for this mapping
    let updatedTimeSlotPrices: DaySlot[];

    if (
      boxSportMapping.timeSlotPrices &&
      Array.isArray(boxSportMapping.timeSlotPrices)
    ) {
      updatedTimeSlotPrices = (boxSportMapping.timeSlotPrices as DaySlot[]).map(
        (dayObj: DaySlot) => ({
          ...dayObj,
          slots: dayObj.slots.map((slot: SlotTimes) => ({
              ...slot,
              price: slot.price === oldDefaultPrice / 2 ? price / 2 : slot.price,
              gst: gst/2,
          })),
        })
      );
    } else {
      updatedTimeSlotPrices = venueTimingArr.map(
        (dayObj: { day: string; open: string; close: string }) => ({
          day: dayObj.day,
          slots: generateSlotsForDay(dayObj.open, dayObj.close, price, gst/2 ),
        })
      );
    }

    logger.info("updatedTimeSlotPrices",updatedTimeSlotPrices);

    // ✅ 1) Update current BoxSportMapping first
    await boxSportMapping.update({
      defaultPrice: price,
      timeSlotPrices: updatedTimeSlotPrices,
      gst: gst,
    });

    // ✅ 2) Fetch all boxes for this venue
    const allBoxes = await Boxes.findAll({
      where: { venueId },
      attributes: ["id"],
    });
    const allBoxIds = allBoxes.map((b) => b.id);

    // ✅ 3) Fetch all mappings again (with latest data)
    const allMappings = await BoxSportMapping.findAll({
      where: { boxId: allBoxIds },
      attributes: ["timeSlotPrices"],
    });

    // ✅ 4) Collect all prices from all mappings 
    const allPrices: number[] = [];
    for (const map of allMappings) {
      const prices = (map.timeSlotPrices || []) as DaySlot[];
      for (const day of prices) {
        for (const slot of day.slots) {
          if (typeof slot.price === "number" && slot.price !== 0) {
            allPrices.push(slot.price);
          }
        }
      }
    }
    const minPrice = allPrices.length ? Math.min(...allPrices) : 0;
    const maxPrice = allPrices.length ? Math.max(...allPrices) : 0;

    // ✅ 5) Update venue min/max prices
    await Venues.update(
      { venueMinPrice: minPrice * 2, venueMaxPrice: maxPrice * 2 },
      { where: { id: venueId } }
    );
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

const addVenueTiming = async (req: Request) => {
  try {
    const { venueId, venueTiming } = req.body;

    const venue = await models.Venues.findByPk(venueId, {
      attributes: ["id", "venueTiming"],
    });
    if (!venue) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.venue_not_found")
      );
    }

    const boxesId = await models.Boxes.findAll({
      where: { venueId },
      attributes: ["id"],
    });
    if (!boxesId) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.Box_not_found_in_venue")
      );
    }
    const boxIds = boxesId.map((box: { id: string }) => box.id);

    const mappings = await BoxSportMapping.findAll({
      where: { boxId: { [Op.in]: boxIds } },
      attributes: ["id", "boxId", "timeSlotPrices", "defaultPrice"],
    });
    if (!boxesId) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.BoxSportMapping_not_found")
      );
    }

    for (const mapping of mappings) {
      const oldPrices = mapping.timeSlotPrices || [];
      const defaultPrice = mapping.defaultPrice ?? 0;

      const updatedTimeSlotPrices = venueTiming.map(
        (dayObj: {
          day: string;
          open: string | null;
          close: string | null;
        }) => {
          const prevDaySlots =
            oldPrices.find((d) => d.day === dayObj.day)?.slots || [];

          const newSlots = generateSlotsForDay(
            dayObj.open,
            dayObj.close,
            defaultPrice
          );

          const mergedSlots = newSlots.map((slot) => {
            const existing = prevDaySlots.find(
              (s) =>
                s.startTime === slot.startTime &&
                s.endTime === slot.endTime &&
                typeof s.price === "number"
            );
            return {
              ...slot,
              price: existing ? existing.price : slot.price,
            };
          });

          return {
            day: dayObj.day,
            slots: mergedSlots,
          };
        }
      );

      await mapping.update({ timeSlotPrices: updatedTimeSlotPrices });
    }
    await venue.update({ venueTiming });

    return venue;
  } catch (err) {
    handleError(err, { req });
  }
};

const updateTimeSlotPrices = async (req: Request) => {
  try {
    logger.info("req.body",req.body);
    const { startTime, endTime, price, sportId, weekDay, boxId,gst } = req.body;
    const start = timeToDate(startTime);
    const end = timeToDate(endTime);
    const sportIdArray = Array.isArray(sportId) ? sportId : [sportId];

    const mappings = await BoxSportMapping.findAll({
      where: {
        boxId,
        sportId: { [Op.in]: sportIdArray },
      },
      attributes: ["id", "timeSlotPrices", "boxId"],
    });

    if (!mappings.length) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.boxSportMappingNotFound")
      );
    }

    const allSkippedDays: string[] = [];
    const updatedMappings: {
      mapping: BoxSportMappingInstance;
      updatedSlots: DaySlot[];
    }[] = [];

    for (const mapping of mappings) {
      const updatedSlots = structuredClone(
        mapping.timeSlotPrices || []
      ) as DaySlot[];
      const skippedDays: string[] = [];

      for (const day of weekDay) {
        const daySlot = updatedSlots.find((d) => d.day === day);

        if (!daySlot) {
          skippedDays.push(`${day}`);
          continue;
        }

        const isClosed = daySlot.slots.every(
          (s) => !s.startTime && !s.endTime && !s.price
        );
        if (isClosed) {
          skippedDays.push(`${day}`);
          continue;
        }

        const matchedSlots = daySlot.slots.filter((slot) => {
          if (!slot.startTime || !slot.endTime) return false;

          const slotStart = timeToDate(slot.startTime);
          const slotEnd = timeToDate(slot.endTime);
          return slotEnd > slotStart && slotStart >= start && slotEnd <= end;
        });

        if (!matchedSlots.length) {
          skippedDays.push(`${day}`);
          continue;
        }

        matchedSlots.forEach((slot) => (slot.price = price ? price / 2 : 0, slot.gst = slot.gst !== gst / 2 ? gst/2 : slot.gst));
      }

      updatedMappings.push({ mapping, updatedSlots });
      allSkippedDays.push(...skippedDays);
    }

    await Promise.all(
      updatedMappings.map((m) =>
        m.mapping.update({ timeSlotPrices: m.updatedSlots })
      )
    );

    const box = await Boxes.findByPk(boxId, {
      attributes: ["id", "venueId"],
    });
    if (!box) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.boxNotFound")
      );
    }

    const allBoxes = await Boxes.findAll({
      where: { venueId: box.venueId },
      attributes: ["id"],
    });
    const allBoxIds = allBoxes.map((b) => b.id);

    const allMappings = await BoxSportMapping.findAll({
      where: { boxId: { [Op.in]: allBoxIds } },
      attributes: ["timeSlotPrices"],
    });

    const allPrices = allMappings.flatMap((m) =>
      (m.timeSlotPrices || []).flatMap((day) =>
        day.slots
          .map((s) => s.price)
          .filter((p): p is number => typeof p === "number" && p !== 0) 
      )
    );

    const minPrice = allPrices.length ? Math.min(...allPrices) : 0;
    const maxPrice = allPrices.length ? Math.max(...allPrices) : 0;

    await Venues.update(
      { venueMinPrice: minPrice * 2, venueMaxPrice: maxPrice * 2 },
      { where: { id: box.venueId } }
    );

    logger.info("allSkippedDays:===>", allSkippedDays);

    if (allSkippedDays.length) {
      throw new CustomAppError(
        StatusCodes.UNPROCESSABLE_ENTITY,
        `Unable to set pricing: Please configure timings for ${allSkippedDays.join(
          " "
        )} before adding variable pricing.`
      );
    }

    return mappings;
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

const findVenues = async (query: FindVenuesQuery, req: Request) => {
  try {
    const { search, city } = query;
    const venues = await models.Venues.findAll({
      attributes: ["id", "venueName"],
      where: {
        [Op.and]: [
          { city: { [Op.iLike]: `%${city}%` } },
          { venueName: { [Op.iLike]: `%${search}%` } },
        ],
      },
    });
    return venues;
  } catch (error: unknown) {
    handleError(error, { req });
  }
};

const venueDetail = async (query: venueDetailQuery, req: Request) => {
  try {
    const { venueId, latitude, longitude,sportId } = query;
    logger.info("venueDetail query params:", sportId);
    const venue = await models.Venues.findOne({
      where: { id: venueId },
      attributes: [
        "id",
        "venueName",
        "images",
        "venueTiming",
        "venueMinPrice",
        "location",
        "aboutVenue",
        "latitude",
        "longitude",
        "policy",
        "isFeatured",
      ],
    });

    if (!venue) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.venue_not_found")
      );
    }

    // Calculate distance_km if lat/lng provided
    let distance_km: string | null = null;
    if (
      latitude &&
      longitude &&
      venue.latitude !== undefined &&
      venue.longitude !== undefined
    ) {
      distance_km =
        calculateDistance(
          Number(latitude),
          Number(longitude),
          Number(venue.latitude),
          Number(venue.longitude)
        ).toFixed(2) + " km";
    }

    const venueTimingArr: {
      day: string;
      open: string | null;
      close: string | null;
    }[] =
      typeof venue.venueTiming === "string"
        ? JSON.parse(venue.venueTiming)
        : venue.venueTiming;

    // Get all boxes for this venue
    const boxesRaw = await models.Boxes.findAll({
      where: { venueId },
      attributes: ["id", "boxName"],
      raw: true,
    });

    const boxes: BoxType[] = boxesRaw.map(
      (box: { id: string; boxName?: string }) => ({
        id: box.id,
        boxName: box.boxName ?? "",
      })
    );
    const boxIds = boxes.map((box) => box.id);

    // Get all sport mappings for these boxes
    const boxSportMappingsRaw = await models.BoxSportMapping.findAll({
      where: { boxId: boxIds },
      attributes: ["boxId", "defaultPrice", "timeSlotPrices", "sportId"],
      raw: true,
    }); 

    const boxSportMappings: {
      boxId: string;
      defaultPrice: number;
      timeSlotPrices: timeSlotPrices[];
      sportId?: string | undefined;
    }[] =
      boxSportMappingsRaw.map(
        (mapping: {
          boxId: string;
          defaultPrice?: number;
          timeSlotPrices?: timeSlotPrices[];
          sportId?: string;
        }) => {
          const ts = Array.isArray(mapping.timeSlotPrices)
              ? mapping.timeSlotPrices
              : [];

          return{
                boxId: mapping.boxId,
                defaultPrice: mapping.defaultPrice ?? 0,
                timeSlotPrices: ts ?? [],
                sportId: mapping.sportId,
          };
        }
      ).filter((m) => {
          const hasDefault = (m.defaultPrice ?? 0) > 0;
          const hasTimeSlots =
            Array.isArray(m.timeSlotPrices) && m.timeSlotPrices.length > 0;
          return hasDefault || hasTimeSlots;
        });

    // Get unique sportIds
    const allSportIds = [
      ...new Set(
        boxSportMappings
          .map((m) => m.sportId)
          .filter((id): id is string => !!id)
      ),
    ];

    // Fetch sport names
   let sportList: { id: string; name: string }[] = [];
    if (allSportIds.length > 0) {
      const sportIdsWithPositivePrice = new Set<string>();
      for (const m of boxSportMappings) {
        const sid = m.sportId;
        if (!sid) continue;
        const sidStr = String(sid);

        // Check defaultPrice
        const defaultPrice = Number(m.defaultPrice ?? 0);
        if (defaultPrice > 0) {
          sportIdsWithPositivePrice.add(sidStr);
          continue;
        }

        // Check timeSlotPrices for any positive slot price
        const daySlots = m.timeSlotPrices ?? [];
        for (const day of daySlots) {
          if (!day || !Array.isArray(day.slots)) continue;
          for (const slot of day.slots) {
            if (typeof slot.price === "number" && slot.price > 0) {
              sportIdsWithPositivePrice.add(sidStr);
              break;
            }
          }
          if (sportIdsWithPositivePrice.has(sidStr)) break;
        }
      }

      const filteredSportIds = [...sportIdsWithPositivePrice];
      if (filteredSportIds.length > 0) {
        const sportsRaw = await models.Sports.findAll({
          where: { id: filteredSportIds },
          attributes: ["id", "sportName"],
          raw: true,
        });
        sportList = sportsRaw.map(
          (sport: { id: string; sportName?: string }) => ({
            id: sport.id,
           name: sport.sportName ?? "",
         })
       );
      } else {
        sportList = [];
      }
    }

    const selectedSportName =
      sportList.find((sport) => String(sport.id) === String(sportId))?.name ??
      sportList[0]?.name ??
      null;

    await ensureVenueImageCache(
      venue as unknown as UpdatableVenueImageRecord,
      selectedSportName
    );

    // Group sport mappings by boxId
    const boxToSportMap: Record<string, BoxSportMappingType[]> = {};
    for (const mapping of boxSportMappings) {

      if (mapping.sportId === undefined || mapping.sportId === null) {
        continue;
      }

      if (!boxToSportMap[mapping.boxId]) {
        boxToSportMap[mapping.boxId] = [];
      }
      boxToSportMap[mapping.boxId].push(mapping as BoxSportMappingType);
    }

    // Filter boxes: only include boxes that have the selected sport (if sportId provided)
    const filteredBoxes = sportId
      ? boxes.filter((box) => {
          const mappingsForBox = boxToSportMap[box.id] || [];
          return mappingsForBox.some((m) => String(m.sportId) === String(sportId) && (m.defaultPrice ?? 0) > 0);
        })
      : boxes;

    const result = {
      venueId: venue.id,
      venueName: venue.venueName,
      location: venue.location,
     images: extractValidImages(venue.images),
      venueTiming: venueTimingArr,
      sportList,
      distance_km,
      aboutVenue: venue.aboutVenue,
      policy: venue.policy,
      isFeatured: venue.isFeatured,
      boxes: filteredBoxes.map((box) => {
        let sportMappings = boxToSportMap[box.id] || [];

        if (sportId) {
          sportMappings = sportMappings.filter(
            (m) => String(m.sportId) === String(sportId)
          );
        }

        const weekdays = (venueTimingArr || []).map((dayObj) => {
          const day = dayObj.day.toLowerCase();

          const slotMap: Map<string, SlotTime> = new Map();

          for (const sportMap of sportMappings) {
            const timeSlotPrices = sportMap.timeSlotPrices || [];
            const defaultPrice = sportMap.defaultPrice;

            const currentDaySlot = timeSlotPrices.find(
              (d) => d.day?.toLowerCase() === day
            );

            if (currentDaySlot && Array.isArray(currentDaySlot.slots)) {
              for (const slot of currentDaySlot.slots) {
                const key = `${slot.startTime}-${slot.endTime}`;

                if (slot.price !== null && slot.price !== defaultPrice / 2) {
                  const existing = slotMap.get(key);
                  if (
                    !existing ||
                    (slot.price !== null &&
                      slot.price < (existing.price ?? Infinity))
                  ) {
                    slotMap.set(key, {
                      startTime: slot.startTime,
                      endTime: slot.endTime,
                      price: slot.price,
                    });
                  }
                }
              }
            }
          }

          const slotsArray: SlotTime[] = Array.from(slotMap.values()).sort(
            (a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? "")
          );

          const merged = mergeContinuousSlots(slotsArray);

          // prefer mapping for the filtered sport (if provided), else any mapping for the box
          const mappingForBox =
            sportMappings[0] ??
            boxToSportMap[box.id]?.[0];

          const halfDefaultPrice: number | null =
            mappingForBox?.defaultPrice
              ? mappingForBox?.defaultPrice / 2
              : null;

          const prices: SlotTime[] = [
            {
              startTime: dayObj.open,
              endTime: dayObj.close,
              price: halfDefaultPrice,
            },
            ...merged,
          ];
          return {
            day: dayObj.day,
            prices,
          };
        });

        const chosenMapping = (boxToSportMap[box.id] || []).find(
          (m) => (sportId ? String(m.sportId) === String(sportId) : true)
        );

        return {
          id: box.id,
          name: box.boxName,
          // attach defaultPrice and timeSlotPrices for the requested sport (if present)
          defaultPrice: chosenMapping?.defaultPrice ?? null,
          weekdays,
        };
      }),
    };

    return result;  } catch (error: unknown) {
      logger.info("erroe ====>",error);
    handleError(error, { req });
  }
};

const getVenueImages = async (req: Request) => {
  try {
    const { venueId } = req.params;

    const venue = await models.Venues.findByPk(Array.isArray(venueId) ? venueId[0] : venueId, {
      attributes: ["id", "images", "venueSports"],
    });

    if (!venue) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.venue_not_found")
      );
    }

    let sportType =
      Array.isArray(venue.venueSports) && venue.venueSports.length > 0
        ? venue.venueSports[0]
        : null;

    if (!sportType) {
      const boxIds = (
        await Boxes.findAll({
          where: { venueId },
          attributes: ["id"],
        })
      ).map((box) => box.id);

      if (boxIds.length > 0) {
        const firstMapping = await BoxSportMapping.findOne({
          where: { boxId: { [Op.in]: boxIds }, defaultPrice: { [Op.gt]: 0 } },
          attributes: ["sportId"],
          order: [["created_at", "ASC"]],
        });

        if (firstMapping?.sportId) {
          const sport = await models.Sports.findByPk(firstMapping.sportId, {
            attributes: ["sportName"],
          });
          sportType = sport?.sportName ?? null;
        }
      }
    }

    const cachedImages = await ensureVenueImageCache(
      venue as unknown as UpdatableVenueImageRecord,
      sportType
    );

    return {
      primary: cachedImages[0] ?? null,
      gallery: cachedImages.slice(1, MAX_DYNAMIC_VENUE_IMAGES),
    };
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

const getVenueDetail = async (req: Request) => {
  try {
    const { venueId } = req.params;

    // 1. Venue lookup
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

    // 2. All boxes in this venue
    const boxes = await Boxes.findAll({
      where: { venueId },
      attributes: ["id", "boxName"],
    });
    const boxIds = boxes.map((b) => String(b.id));

    if (!boxIds.length) {
      return { venueTiming: venue.venueTiming, boxes: [] };
    }

    // 3. Get all mappings for all boxes (single query)
    const mappings = await BoxSportMapping.findAll({
      where: { boxId: boxIds },
      attributes: ["boxId", "sportId", "defaultPrice"],
    });

    // 4. Collect all sportIds
    const sportIds = [...new Set(mappings.map((m) => String(m.sportId)))];

    // 5. Fetch all sports (one query)
    const sportList = await models.Sports.findAll({
      where: { id: sportIds },
      attributes: ["id", "sportName"],
    });

    // Map sportId -> sport details (normalize IDs to string)
    const sportMap = new Map<string, { id: string; sportName: string }>(
      sportList.map((s) => [
        String(s.id),
        { id: String(s.id), sportName: s.sportName ?? "" },
      ])
    );

    // 6. Build box details
    const boxDetails = boxes.map((box) => {
      const boxMappings = mappings.filter(
        (m) => String(m.boxId) === String(box.id)
      );

      const hasDefaultPrice = boxMappings.some(
        (m) =>
          m.defaultPrice !== null &&
          m.defaultPrice !== undefined &&
          Number(m.defaultPrice) !== 0
      );

      const sports =
        boxMappings
          .map((m) => sportMap.get(String(m.sportId)))
          .filter((s): s is { id: string; sportName: string } => Boolean(s)) ??
        [];

      return {
        boxId: String(box.id),
        boxName: box.boxName ?? "",
        isClose: !hasDefaultPrice,
        sports,
      };
    });

    // 7. Final response
    return {
      venueTiming: venue.venueTiming,
      boxes: boxDetails,
    };
  } catch (error: unknown) {
    handleError(error, { req });
  }
};

const getBoxDetail = async (req: Request) => {
  try {
    const { boxId } = req.params;

    const box = await Boxes.findOne({
      where: { id: boxId },
      attributes: ["id", "boxName"],
    });

    if (!box) {
      throw new CustomAppError(
        StatusCodes.NOT_FOUND,
        req.t("errorMessages.Box_not_found")
      );
    }

    const mappings = await BoxSportMapping.findAll({
      where: { boxId },
      attributes: ["sportId", "timeSlotPrices", "defaultPrice"],
    });

    const sportIds = mappings.map((m) => m.sportId);
    const uniqueSportIds = [...new Set(sportIds)];

    const sportList = await models.Sports.findAll({
      where: { id: uniqueSportIds },
      attributes: ["id", "sportName"],
    });
    const sportNameMap: Record<string, string> = {};
    for (const sport of sportList) {
      sportNameMap[sport.id] = sport.sportName ?? "";
    }
    const result = mappings.map((mapping) =>
      groupSlotsByPrice(
        mapping.timeSlotPrices || [],
        mapping.sportId, 
        sportNameMap[mapping.sportId],
        mapping.defaultPrice ?? 0
      )
    );

    return result;
  } catch (error: unknown) {
    handleError(error, { req });
  }
};

const gerVenuesListBySearch = async (query: VenuesListQuery, req: Request) => {
  try {
    const { city, search } = query;

    // Build basic where clause
    const whereClause: WhereOptions = {};
    if (city) {
      const cityAndState = city.split(", ");
      whereClause.city = cityAndState[0];
      if (cityAndState[1]) {
        whereClause.state = cityAndState[1];
      }
    }

    if (search) {
      whereClause.venueName = { [Op.iLike]: `%${search}%` };
      whereClause.venueMinPrice= { [Op.gt]: 0 };
      whereClause.venueMaxPrice= { [Op.gt]: 0 };
    }

    // Fetch only id and name
    const venues = await Venues.findAll({
      attributes: ["id", "venueName"],
      where: whereClause,
      order: [["venueName", "ASC"]],
    });

    // Format response
    return venues.map((v) => ({
      id: v.id,
      venue_name: v.venueName,
    }));
  } catch (error: unknown) {
    handleError(error, {
      req,
      version,
      priority: constant.PRIORITY.LOW,
    });
  }
};

const getOwnerVenueList = async(req: Request)=>{
  try{
    const { ownerId } = req.query;

    if (!ownerId) {
      throw new CustomAppError(
        StatusCodes.BAD_REQUEST,
        req.t?.("errorMessages.ownerIdRequired") ?? "ownerId is required"
      );
    }

    const whereClause: WhereOptions = {
      boxOwnerId: { [Op.contains]: [ownerId as string] },
    };

    const businessDetails = await Business.findAll({
      where: whereClause,
      attributes: ["id", "businessName"],
      raw: true,
    });
    
    // If no businesses, return empty list in same shape as login
    if (!businessDetails || businessDetails.length === 0) {
      return { venueDetails: [] };
    }

    const businessIds = businessDetails.map((b) => b.id);

    // Fetch venues for those businesses
    const venuesData = await Venues.findAll({
      where: { businessId: { [Op.in]: businessIds } },
      attributes: ["id", "venueName", "businessId"],
      raw: true,
    });

    // Group venues by businessId for quick lookup
    const venuesByBusiness = new Map<string, { id: string; name: string }[]>();
    for (const v of venuesData) {
      const bid = v.businessId as string;
      if (!venuesByBusiness.has(bid)) {
        venuesByBusiness.set(bid, []);
      }
      venuesByBusiness.get(bid)!.push({
        id: v.id,
        name: v.venueName ?? "",
      });
    }

    // Build venueDetails in the same format as login
    const venueDetails = businessDetails.flatMap((business) => {
      const venues = venuesByBusiness.get(business.id) || [];
      return venues.map((venue) => ({
        id: venue.id,
        name: `${business.businessName} - ${venue.name}`,
      }));
    });
    return { venueDetails };
  }
  catch(error:unknown){
    handleError(error, { req });
    // throw error;
  }
};

export default {
  getCityList,
  venuesList,
  getPreferredImage,
  extractValidImages,
  venuesHomepageList,
  fixedPrice,
  addVenueTiming,
  updateTimeSlotPrices,
  findVenues,
  venueDetail,
  getVenueDetail,
  getBoxDetail,
  getVenueImages,
  gerVenuesListBySearch,
  getOwnerVenueList
};
