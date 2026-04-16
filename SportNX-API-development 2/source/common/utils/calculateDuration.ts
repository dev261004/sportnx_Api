const calculateDuration = (
  start?: string | Date,
  end?: string | Date
): string => {
  if (!start || !end) return "";

  const toTimeString = (value: string | Date): string => {
    if (typeof value === "string") return value;

    const hours = value.getHours().toString().padStart(2, "0");
    const minutes = value.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const [sh, sm] = toTimeString(start).split(":").map(Number);
  const [eh, em] = toTimeString(end).split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);

  const h = Math.floor(mins / 60);
  const m = mins % 60;

  return `${h > 0 ? `${h} h` : ""} ${m > 0 ? `${m} min` : "00 min"}`.trim();
};

export default calculateDuration;
