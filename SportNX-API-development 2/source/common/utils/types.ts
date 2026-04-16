import joi from "joi";
import { UUID } from "crypto";
import { CreationOptional } from "sequelize";
import { Blob } from "buffer";
import constant from "../config/constant";
import { Request } from "express";

export interface ErrorHandlerOptions {
  req: Request;
  version?: string;
  priority?: string;
}

export interface AppError {
  status: number;
  isOperational?: boolean;
  message: string;
  stack?: string;
}

export interface DecodedTokenPayload {
  sub: { userId: string; role: string } | string; // Handle both cases: object with `user` or string
}

interface decodedUserData {
  userId: string;
  role?: string | null | undefined;
}

export interface jwtPayload {
  sub: decodedUserData;
  iat: number;
  exp?: number;
}

export interface ErrorWithStatus extends Error {
  status?: number;
}

export interface ApiResponse {
  message: string;
  data?: object[] | object;
}

export interface EnvironmentVariables {
  NODE_ENV: "development" | "live" | "staging";
  PORT: number;
  DATABASE_URL: string;
  ENCRYPTION_KEY: string;
  ENCRYPTION_IV: string;
  DB_ENCRYPTION_KEY: string;
  WEB_URL: string;
  GMAIL_USER: string;
  GMAIL_PASSWORD: string;
  EMAIL_OWNER: string;
}

export interface RequestSchema {
  params?: joi.ObjectSchema;
  query?: joi.ObjectSchema;
  body?: joi.ObjectSchema;
}

export interface CustomerAttributes {
  id: CreationOptional<UUID>;
  sportId: CreationOptional<UUID> | string;
  fullName?: string;
  countryCode?: string;
  phoneNumber?: Blob | string;
  latitude?: number;
  longitude?: number;
  location?: string;
  otp?: number | null;
  otpExpiry?: Date | null;
  razorpayCustomerId?: string;
  fcmToken?: string[];
}

type status = "active" | "disable";

export interface SportsAttributes {
  id: CreationOptional<UUID>;
  sportIcon?: string;
  sportName?: string;
  status?: status;
}

export type failedAttempt = 0 | 1 | 2 | 3 | 4 | 5;

export interface AttemptAttributes {
  id: CreationOptional<UUID>;
  userId: CreationOptional<UUID>;
  userRole: typeof constant.ROLE.USER | typeof constant.ROLE.OWNER;
  endPoint?: string;
  failedAttempt?: failedAttempt;
  failedTimeStamp?: Date;
}

type businessStatus = "active" | "disable" | "deleted" | "invited";

// export interface BusinessAttributes {
//   id: CreationOptional<UUID>;
//   boxOwnerId: CreationOptional<UUID[]>;
//   businessName?: string;
//   gstNumber?: string;
//   businessLogo?: string;
//   status?: businessStatus;
//   bankAccount?: Blob;
// }

export interface BusinessAttributes {
  id: CreationOptional<UUID>;
  boxOwnerId: CreationOptional<UUID[]>;
  businessName?: string;
  gstNumber?: string;
  businessLogo?: string;
  status?: businessStatus;
  bankAccount?: string | Buffer;
  ifscCode?: string | Buffer;
}

export interface BoxOwnerAttributes {
  id: CreationOptional<UUID>;
  fullName?: string;
  emailAddress?: Blob;
  countryCode?: string;
  phoneNumber?: Blob;
  hash?: string;
  otp?: number | null;
  otpExpiry?: Date | null;
  status?: businessStatus;
  fcmToken?: string[];
  passwordHistory?: string[];
}

export interface VenueAttributes {
  id: CreationOptional<UUID>;
  boxOwnerId: CreationOptional<UUID>;
  businessId: CreationOptional<UUID>;
  venueName?: string;
  aboutVenue?: string;
  venueTiming?: string;
  venueMinPrice?: number;
  venueMaxPrice?: number;
  venueSports?: Array<string>;
  latitude?: number;
  longitude?: number;
  location?: string;
  area?: string;
  city?: string;
  state?: string;
  country?: string;
  images?: Array<string>;
  isFeatured?: boolean;
  policy?: string;
}

export interface BoxesAttributes {
  id: CreationOptional<UUID>;
  venueId: CreationOptional<UUID>;
  boxName?: string;
  status?: status;
}

export interface SlotTime {
  gst?: number | null;
  startTime: string | null;
  endTime: string | null;
  price: number | null;
}

export interface timeSlotPrices {
  day: string;
  slots: SlotTime[];
}

export interface BoxSportMappingAttributes {
  id: CreationOptional<UUID>;
  boxId: CreationOptional<UUID>;
  sportId: CreationOptional<UUID>;
  defaultPrice?: number;
  gst?: number;
  minDuration?: number;
  timeSlotPrices?: timeSlotPrices[];
}

type paymentStatus = "partial" | "full_paid" | "pending" | "refunded";
type bookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "failed"
  | "expired";

export interface BookingAttributes {
  id: CreationOptional<UUID>;

  ownerId?: CreationOptional<UUID> | null;
  customerId?: CreationOptional<UUID> | null;

  venueId: UUID;
  boxId: UUID;
  sportId: UUID;

  bookingDate: Date;

  startTime: string; 
  endTime: string;   



  startTs: Date;        
  endTs: Date;          
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bookingTsrange: any;  // PostgreSQL tsrange (handled via literal)

  /* ---------- BUSINESS DATA ---------- */

  customerDetails?: CustomerDetails;
  slotPrices?: Slots[];

  paidAmount?: number;
  paymentStatus?: paymentStatus;

  dueAmount?: number;
  bookingAmount?: BookingAmount | null;
  convenienceFees?: ConvenienceFees;
  totalAmount?: number;

  bookingStatus?: bookingStatus;

  razorpayPaymentId?: string;
  razorpayPaymentMethod?: string;

  sport?: {
    sportName: string;
  };

  refundAmount?: number;
  cancellationDetails?: cancellationDetails;

  created_at?: string;
  expiresAt?: Date;
}

interface cancellationDetails {
  cancellationTimeStamp: string | Date;
  beforeFourHours?: boolean;
  razorpayPaymentId?: string;
}
export interface SetPasswordBody {
  email: string;
  newPassword: string;
  confirmPassword: string;
}

export interface LoginBody {
  email?: string;
  phone?: string;
  password: string;
  fcmToken: string;
}

export interface ForgotPasswordBody {
  email: string;
}

export interface VerifyOTPBody {
  email?: string;
  phone?: string;
  otp?: string;
}

export interface ResetPasswordBody {
  email?: string;
  phone?: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
export interface ResendOTPBody {
  email: string;
}

export interface LoginBodyUser {
  phone: string;
  latitude?: number;
  longitude?: number;
  location?: string;
  sport?: string;
  fcmToken?: string;
}
export interface VerifyOTPBodyUser {
  phone: string;
  otp: number;
}

export interface OnboardBody {
  userid: string;
  name: string;
}

export interface ResendOTPBodyUser {
  phone: string;
}

export interface editProfileBody {
  name?: string;
  phone?: string;
  userId: string;
}

// export interface deleteUserQuery{
//   customerId:string;
// }

export interface SetSportsBody {
  phone: string;
  sportId: string;
}

export interface SetLocationBody {
  phone: string;
  city: string;
  latitude: number | string;
  longitude: number | string;
}

export interface refreshTokendBody {
  refresh_token: string;
}

export interface logoutBody {
  fcmToken: string;
}

export interface UserData {
  userId: string;
  role: typeof constant.ROLE.OWNER | typeof constant.ROLE.USER;
}

export interface UserDetails {
  id: string;
  role: string;
  [key: string]: unknown;
}

export interface ListSlotsQuery {
  venueId: string;
  boxId: string;
}

export interface ListSlotsUserQuery {
  venueId: string;
  sportId: string;
}

export interface SlotPrice {
  day: string;
  slots: Slots[];
}
export interface SlotsTime {
  startTime: string;
  endTime: string;
  prices: { sportId: string; sportName: string; price: number | null; gst: number | null }[];
  isBooked: boolean;
}

export interface VenueTiming {
  day: string;
  open: string | null;
  close: string | null;
}

export interface VenuesListQuery {
  sportId: string;
  city: string;
  search?: string;
  latitude?: number;
  longitude?: number;
  sortBy?: string;
  date: string;
  fromTime: string;
  duration: number;
  page: number;
  limit: number;
  nearest: string;
}

export interface userBookingList{
  customerId:string;
  page?:number;
  limit?:number;
}

// export interface SlotsTimeUser {
//   startTime: string;
//   endTime: string;
//   prices: { sportId: string; sportName: string; price: number | null }[];
//   isBooked: boolean;
//   boxes?: string[];
// }

export interface SlotsTimeUser {
  startTime: string;
  endTime: string;
  prices: {
    sportId: string;
    sportName: string;
    price: number | null;
    gst: number | null;
    isBooked: boolean;
    boxId: string;
    boxName: string;
  }[];
}

export interface FormattedVenue {
  venue_name: string;
  city: string;
  latitude: number;
  longitude: number;
  image: string | null;
  default_price: number | null;
  min_price: number | null;
  max_price: number | null;
  distance_km: string | null;
  boxes: { box_id: string; box_name: string }[];
  area: string;
  isFeatured: boolean;
  id: string;
}

export interface VenueWithBoxes {
  id: string;
  venueName: string;
  city: string;
  latitude: number;
  longitude: number;
  images: string[];
  venueMinPrice: number;
  venueMaxPrice: number;
  distance?: number;
  area: string;
  boxes: BoxWithSportMappings[];
  isFeatured: boolean;
  venueTiming?: VenueTiming[];
}

export interface BoxWithSportMappings {
  id: string;
  boxName: string;
  status: string;
  sportMappings: SportMapping[];
  bookings?: Booking[];
}

interface SportMapping {
  sportId: string;
  defaultPrice: number;
}

interface Booking {
  id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
}

export interface ResponseData {
  title?: string;
  message?: string;
  data?: string;
}

export interface SentryErrorContext {
  req?: Request;
  extra?: Record<string, unknown>;
  tags?: Record<string, string>;
}

export interface PayoutsCalculationsAttributes {
  id: string;
  payout_id: string;
  booking_id: string;
  business_id: string;
  owner_amount: number;
  payout_status: "pending" | "executed";
  created_at?: Date;
  updated_at?: Date;
}

export interface PayoutAttributes {
  id: string;
  box_owner_id: string;
  business_id: string;
  amount: number;
  period: object; // jsonb type
  status: "Pending" | "Success" | "Failed";
  razorpay_payment_id: string;
  razorpay_payment_method: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface VenuesHomepageListQuery {
  affordable_sport?: string;
  budget_sport?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export interface BookingPayload {
  ownerId?: string;
  customerId: string;
  venueId: string;
  boxId: string;
  sportId: string;
  bookings: BookingEntry[];
  customerDetails?: CustomerDetails;

  bookingAmount?: BookingAmount;
  convenienceFees: ConvenienceFees | JSON;
  totalAmount?: number;
  paidAmount?: number;
  dueAmount?: number;
  paymentStatus?: paymentStatus;
}

interface BookingEntry {
  bookingDate: string;
  slots: Slots[];
}

interface BookingAmount {
  total: number;
  base: number;
  GST: number;
}

interface ConvenienceFees {
  total: number;
  platFormFee: number;
  GST: number;
  paymentGateWayFee?: number;
}

interface CustomerDetails {
  name?: string;
  phone: string;
}

export interface Slots {
  gst: number | null;
  startTime: string;
  endTime: string;
  price: number;
}

export interface FixedPriceBody {
  boxId: string;
  sportId: string;
  venueId: string;
  price: number;
  gst:number;
}

export interface SlotTimes {
  startTime: string | null;
  endTime: string | null;
  price: number | null;
  gst: number | null;
}
export interface DaySlot {
  day: string;
  slots: SlotTimes[];
}

export interface FindVenuesQuery {
  search: string;
  city: string;
}

export interface venueDetailQuery {
  venueId: string;
  latitude: number;
  longitude: number;
  sportId: string | null;
}

export type BoxSportMappingType = {
  boxId: string;
  sportId: string;
  defaultPrice: number;
  timeSlotPrices: timeSlotPrices[];
};

export type BoxType = {
  id: string;
  boxName: string;
};

// export type BookingRow = {
//   id: string;
//   startTime: string;
//   endTime: string;
//   totalAmount?: string | number | null;
//   dueAmount?: string | number | null;
//   paymentStatus?: string | null;
//   bookingStatus?: string | null;
//   bookingDate?: Date | string | null;
//   customerDetails?: { name?: string; phone?: string } | null;
//   refundAmount?: string | number | null;
//   paidAmount?: string | number | null;
//   cancellationDetails?: unknown;
//   created_at?: Date | string;
//   ownerId?: string | null;
//   bookingAmount?: unknown;
//   slotPrices?: unknown;
//   razorpayPaymentId?: string | null;
//   bookingVenue?: {
//     id?: string;
//     venueName?: string;
//     city?: string;
//     address?: string;
//   } | null;
//   box?: { id?: string; boxName?: string; image?: string | null } | null;
//   sport?: { sportName?: string } | null;
// };
