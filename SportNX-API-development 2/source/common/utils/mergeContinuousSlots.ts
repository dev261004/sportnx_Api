import { SlotTime } from "./types";

const mergeContinuousSlots = (slots: SlotTime[]) => {
  if (!slots || slots.length === 0) return [];
  const merged: SlotTime[] = [];
  let current: SlotTime = { ...slots[0] };

  for (let i = 1; i < slots.length; i++) {
    const slot = slots[i];
    if (slot.price === current.price && slot.startTime === current.endTime) {
      current.endTime = slot.endTime;
    } else {
      merged.push({ ...current });
      current = { ...slot };
    }
  }
  merged.push({ ...current });
  return merged;
};

export default mergeContinuousSlots;
