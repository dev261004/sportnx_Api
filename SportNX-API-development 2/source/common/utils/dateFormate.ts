function timeToDate(timeStr: string) {
  const [hours, minutes, seconds] = timeStr.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, seconds || 0, 0);
  return date;
}

export default timeToDate;
