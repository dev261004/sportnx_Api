import { SlotTime, timeSlotPrices } from "./types";

const groupSlotsByPrice = (
  timeSlotPrices: timeSlotPrices[],
  sportId: string,
  sportName: string,
  defaultPrice: number
) => {
  const groupedTimeSlotPrices = timeSlotPrices.map(
    ({ day, slots }: { day: string; slots: SlotTime[] }) => {
      const groupedSlots = [];
      let currentGroup: SlotTime | null = null;

      for (const slot of slots) {
        const { startTime, endTime, price } = slot;
        if (!price || !startTime || !endTime) continue;

        if (
          currentGroup &&
          currentGroup.price === price &&
          currentGroup.endTime === startTime
        ) {
          currentGroup.endTime = endTime;
        } else {
          if (currentGroup) {
            groupedSlots.push(currentGroup);
          }
          currentGroup = { startTime, endTime, price };
        }
      }

      if (currentGroup) {
        groupedSlots.push(currentGroup);
      }

      return { day, slots: groupedSlots };
    }
  );

  return {
    sportId,
    defaultPrice,
    sportName,
    timeSlotPrices: groupedTimeSlotPrices,
  };
};

export default groupSlotsByPrice;
