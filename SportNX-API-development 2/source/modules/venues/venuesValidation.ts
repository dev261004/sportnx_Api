import joi from "joi";
import { RequestSchema } from "../../common/utils/types";
import constant from "../../common/config/constant";

const venuesList: RequestSchema = {
  query: joi.object().keys({
    sportId: joi.string().uuid().required(),
    city: joi.string().required(),
    search: joi.string().optional(),
    latitude: joi.number().required(),
    longitude: joi.number().required(),
    sortBy: joi.string().valid("asc", "desc").optional(),
    date: joi.string().optional(),
    fromTime: joi.string().optional(),
    duration: joi.number().optional(),
    page: joi.number().optional(),
    limit: joi.number().optional(),
    nearest: joi.string().valid("true", "false").optional(),
  }),
};

const venuesHomepageList: RequestSchema = {
  query: joi.object().keys({
    affordable_sport: joi.string().uuid().required(),
    city: joi.string().required(),
    latitude: joi.number().required(),
    longitude: joi.number().required(),
  }),
};

const fixedPrice: RequestSchema = {
  body: joi.object().keys({
    boxId: joi.string().uuid().required(),
    sportId: joi.string().uuid().required(),
    venueId: joi.string().uuid().required(),
    price: joi.number().required(),
    gst: joi.number().required(),
  }),
};

const addVenueTiming: RequestSchema = {
  body: joi.object({
    venueId: joi.string().uuid().required(),

    venueTiming: joi
      .array()
      .items(
        joi.object({
          day: joi
            .string()
            .valid(...constant.daysOfWeek)
            .required(),
          open: joi.string().allow(null).required(),
          close: joi.string().allow(null).required(),
        })
      )
      .length(7)
      .required()
      .custom((value, helpers) => {
        const inputDays = value.map((item: { day: string }) => item.day);
        const missingDays: string[] = constant.daysOfWeek.filter(
          (day) => !inputDays.includes(day)
        );
        if (missingDays.length > 0) {
          return helpers.message({
            custom: `Missing day(s): ${missingDays.join(", ")}`,
          });
        }
        return value;
      }),
  }),
};

const updateSlotPricesSchema: RequestSchema = {
  body: joi.object({
    startTime: joi
      .string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
      .required(),
    endTime: joi
      .string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
      .required(),
    price: joi.number().min(0).required(),
    gst: joi.number().min(0).required(),
    sportId: joi.array().items(joi.string().uuid()).required(),
    boxId: joi.string().uuid().required(),
    weekDay: joi
      .array()
      .items(joi.string().valid(...constant.daysOfWeek))
      .required()
      .min(1),
  }),
};

const findVenues: RequestSchema = {
  query: joi.object().keys({
    city: joi.string().required(),
    search: joi.string().required(),
  }),
};

const venueDetail: RequestSchema = {
  query: joi.object().keys({
    venueId: joi.string().uuid().required(),
    latitude: joi.number().required(),
    longitude: joi.number().required(),
    sportId: joi.string().uuid().required(),
  }),
};

const getVenueDetail: RequestSchema = {
  params: joi.object().keys({
    venueId: joi.string().uuid().required(),
  }),
};

const getBoxDetail: RequestSchema = {
  params: joi.object().keys({
    boxId: joi.string().uuid().required(),
  }),
};

const getVenueImages: RequestSchema = {
  params: joi.object().keys({
    venueId: joi.string().uuid().required(),
  }),
};

const gerVenuesListBySearch: RequestSchema = {
  query: joi.object().keys({
    city: joi.string().required(),
    search: joi.string().optional(),
  }),
};

const getOwnerVenueList: RequestSchema = {
  query: joi.object().keys({
    ownerId: joi.string().uuid().required(),
  }),
};

export default {
  venuesList,
  venuesHomepageList,
  fixedPrice,
  addVenueTiming,
  updateSlotPricesSchema,
  findVenues,
  venueDetail,
  getVenueDetail,
  getBoxDetail,
  getVenueImages,
  gerVenuesListBySearch,
  getOwnerVenueList
};
