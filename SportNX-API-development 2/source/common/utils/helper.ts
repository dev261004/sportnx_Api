import { Slots } from "./types";
import { CustomHelpers } from "joi";
import moment from "moment";

export const escapeSingleQuotes = (str: string) => {
  return str.replace(/'/g, "''");
};

interface PersonalInfoValidationParams {
  fullName?: string;
  phoneNumber?: string | number;
  emailAddress?: string;
  newPassword: string;
}

export const validatePasswordAgainstPersonalInfo = (
  params: PersonalInfoValidationParams
): boolean => {
  const { fullName, phoneNumber, emailAddress, newPassword } = params;
  const passwordLower = newPassword.toLowerCase();

  // Check full name
  if (fullName) {
    const names = fullName.split(/\s+/).filter(Boolean);

    // Check each part of the name
    const anyNamePresent = names.some((name) =>
      passwordLower.includes(name.toLowerCase())
    );

    // Also check full name (with and without spaces)
    const fullNameNoSpace = fullName.replace(/\s/g, "").toLowerCase();

    if (
      anyNamePresent ||
      passwordLower.includes(fullName.toLowerCase()) ||
      passwordLower.includes(fullNameNoSpace)
    ) {
      return false;
    }
  }

  // Check phone number
  if (phoneNumber) {
    const phone = String(phoneNumber).replace(/\D/g, "");
    if (phone && newPassword.includes(phone)) {
      return false;
    }
  }

  // Check email address
  if (emailAddress) {
    const emailStr = String(emailAddress);
    const emailPrefix = emailStr.split("@")[0].toLowerCase();
    if (emailPrefix && passwordLower.includes(emailPrefix)) {
      return false;
    }
  }

  return true;
};

export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers
  return parseFloat(distance.toFixed(2));
};

export const groupSlots = (slots: Slots[]): Slots[][] => {
  const sortedSlots = [...slots].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );

  const groups: Slots[][] = [];
  let currentGroup: Slots[] = [sortedSlots[0]];

  for (let i = 1; i < sortedSlots.length; i++) {
    const prev = currentGroup[currentGroup.length - 1];
    const curr = sortedSlots[i];

    if (prev.endTime === curr.startTime) {
      currentGroup.push(curr);
    } else {
      groups.push(currentGroup);
      currentGroup = [curr];
    }
  }

  groups.push(currentGroup);
  return groups;
};

export const validateIndianPhone = (value: string, helpers: CustomHelpers) => {
  if (!value.startsWith("+91")) {
    return helpers.error("string.phoneLength");
  }
  const remainingPart = value.substring(3);
  if (!/^\d{10}$/.test(remainingPart)) {
    return helpers.error("string.phoneLength");
  }
  return value;
};

export const validatePasswordComplexity = (
  value: string,
  helpers: CustomHelpers
) => {
  if (!/[a-z]/.test(value)) return helpers.error("string.pattern.lowercase");
  if (!/[A-Z]/.test(value)) return helpers.error("string.pattern.uppercase");
  if (!/[0-9]/.test(value)) return helpers.error("string.pattern.number");
  if (!/[!@#$%^&*()_+={}[\];:'",.<>?/|`~-]/.test(value))
    return helpers.error("string.pattern.special");
  return value;
};

export const validateNoEmojiEmail = (value: string, helpers: CustomHelpers) => {
  const emojiRegex =
    /([\u2700-\u27BF]|[\uE000-\uF8FF]|[\uD83C-\uDBFF\uDC00-\uDFFF])/u;
  if (emojiRegex.test(value)) return helpers.error("string.emojiNotAllowed");
  return value;
};

export function generateSlotsForDay(
  open: string | null,
  close: string | null,
  price: number,
  gst?:number
) {
  if (!open || !close) {
    return [
      {
        price: null,
        startTime: null,
        endTime: null,
        gst: null,
      },
    ];
  }

  const slots = [];
  let start = moment(open, "HH:mm");
  const end = moment(close, "HH:mm");

  while (start.isBefore(end)) {
    const slotStart = start.format("HH:mm:ss");
    const slotEnd = start.clone().add(30, "minutes");
    if (slotEnd.isAfter(end)) break;
    slots.push({
      price: price / 2,
      startTime: slotStart,
      endTime: slotEnd.format("HH:mm:ss"),
      gst: gst ? gst / 2 : 0,
    });
    start = slotEnd;
  }
  return slots;
}
