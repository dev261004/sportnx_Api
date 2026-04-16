const ROLE = {
  OWNER: "owner",
  USER: "user",
} as const;

const STATUS = {
  ACTIVE: "active",
  DISABLE: "disable",
};

const PAYMENT_STATUS = {
  PARTIAL: "partial",
  FULL_PAID: "full_paid",
  PENDING: "pending",
  FAILED: "failed",
  REFUNDED: "refunded",
} as const;

const BOOKING_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  FAILED: "failed",
  EXPIRED: "expired",
} as const;

const END_POINT = {
  FORGOTPASSWORD: "auth/forgot-password",
  RESENDOTP: "auth/resendOTP",
  LOGIN: "auth/login",
  VERIFYOTP: "auth/verifyOTP",
  CHANGEPASSWORD: "auth/change-password",
};

const PRIORITY = {
  HIGH: "high",
  LOW: "low",
};

const ENV = {
  LIVE: "live",
  STAGING: "staging",
  DEVELOPMENT: "development",
};

const COMMON_STATUS = {
  ACTIVE: "active",
  DISABLE: "disable",
  DELETED: "deleted",
  INVITED: "invited",
} as const;

const PASSWORD_MESSAGES = {
  "string.min": "Password must be at least 8 characters long",
  "string.max": "Password must not exceed 16 characters",
  "string.pattern.lowercase":
    "Password must contain at least one lowercase letter",
  "string.pattern.uppercase":
    "Password must contain at least one uppercase letter",
  "string.pattern.number": "Password must contain at least one number",
  "string.pattern.special":
    "Password must contain at least one special character",
};

const PHONE_MESSAGES = {
  "string.countryCode": "Please provide a country code",
  "string.phoneLength": "Please provide a valid phone number",
};

const daysOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const TIME_MESSAGES = {
  "string.invalid": "Invalid time format. Expected HH:mm:ss.",
  "string.custom":
    "Time slot must be exactly 30 minutes. Provided duration is ${{diffMinutes}} minutes.",
};

export default {
  ROLE,
  STATUS,
  PAYMENT_STATUS,
  BOOKING_STATUS,
  END_POINT,
  PRIORITY,
  ENV,
  COMMON_STATUS,
  PASSWORD_MESSAGES,
  PHONE_MESSAGES,
  daysOfWeek,
  TIME_MESSAGES,
};
