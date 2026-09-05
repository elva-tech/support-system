/**
 * Business-hours aware SLA clock utilities.
 * Holidays are intentionally out of scope.
 */

const parseHm = (hm) => {
  const [h, m] = String(hm || "09:00").split(":").map((n) => parseInt(n, 10));
  return { hours: Number.isFinite(h) ? h : 9, minutes: Number.isFinite(m) ? m : 0 };
};

const zonedParts = (date, timeZone) => {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    weekday: weekdayMap[parts.weekday] ?? 0,
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10)
  };
};

const minutesOfDay = (hour, minute) => hour * 60 + minute;

/**
 * Advance `from` by `targetMinutes` of working time under businessHours.
 * When useBusinessHours is false, returns calendar minutes.
 */
const addSlaMinutes = (from, targetMinutes, businessHours = {}, { useBusinessHours = false } = {}) => {
  const start = from instanceof Date ? new Date(from.getTime()) : new Date(from);
  const minutes = Math.max(0, Number(targetMinutes) || 0);

  if (!useBusinessHours || minutes === 0) {
    return new Date(start.getTime() + minutes * 60 * 1000);
  }

  const tz = businessHours.timezone || "Asia/Kolkata";
  const workingDays = Array.isArray(businessHours.workingDays)
    ? businessHours.workingDays
    : [1, 2, 3, 4, 5];
  const startHm = parseHm(businessHours.startTime || "09:00");
  const endHm = parseHm(businessHours.endTime || "18:00");
  const dayStart = minutesOfDay(startHm.hours, startHm.minutes);
  const dayEnd = minutesOfDay(endHm.hours, endHm.minutes);
  const dayCapacity = Math.max(0, dayEnd - dayStart);

  if (dayCapacity <= 0) {
    return new Date(start.getTime() + minutes * 60 * 1000);
  }

  let remaining = minutes;
  let cursor = new Date(start.getTime());
  let guard = 0;

  while (remaining > 0 && guard < 370) {
    guard += 1;
    const z = zonedParts(cursor, tz);
    const nowMin = minutesOfDay(z.hour, z.minute);
    const isWorkingDay = workingDays.includes(z.weekday);

    if (!isWorkingDay || nowMin >= dayEnd) {
      // jump to next calendar day start of business (approx via +1 day at dayStart)
      cursor = new Date(cursor.getTime() + 60 * 60 * 1000);
      const z2 = zonedParts(cursor, tz);
      if (workingDays.includes(z2.weekday) && minutesOfDay(z2.hour, z2.minute) < dayStart) {
        const delta = dayStart - minutesOfDay(z2.hour, z2.minute);
        cursor = new Date(cursor.getTime() + delta * 60 * 1000);
      }
      continue;
    }

    if (nowMin < dayStart) {
      cursor = new Date(cursor.getTime() + (dayStart - nowMin) * 60 * 1000);
      continue;
    }

    const availableToday = dayEnd - nowMin;
    const consume = Math.min(remaining, availableToday);
    cursor = new Date(cursor.getTime() + consume * 60 * 1000);
    remaining -= consume;
  }

  return cursor;
};

/**
 * Working minutes elapsed between from and to (approx).
 */
const elapsedSlaMinutes = (from, to, businessHours = {}, { useBusinessHours = false } = {}) => {
  const start = from instanceof Date ? from.getTime() : new Date(from).getTime();
  const end = to instanceof Date ? to.getTime() : new Date(to).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }
  if (!useBusinessHours) {
    return Math.floor((end - start) / 60000);
  }

  // Sample forward in 15-min steps for approximate business elapsed time
  let elapsed = 0;
  let cursor = start;
  const tz = businessHours.timezone || "Asia/Kolkata";
  const workingDays = Array.isArray(businessHours.workingDays)
    ? businessHours.workingDays
    : [1, 2, 3, 4, 5];
  const startHm = parseHm(businessHours.startTime || "09:00");
  const endHm = parseHm(businessHours.endTime || "18:00");
  const dayStart = minutesOfDay(startHm.hours, startHm.minutes);
  const dayEnd = minutesOfDay(endHm.hours, endHm.minutes);
  const step = 15;

  while (cursor < end) {
    const z = zonedParts(new Date(cursor), tz);
    const nowMin = minutesOfDay(z.hour, z.minute);
    if (workingDays.includes(z.weekday) && nowMin >= dayStart && nowMin < dayEnd) {
      elapsed += step;
    }
    cursor += step * 60 * 1000;
  }
  return elapsed;
};

const percentConsumed = (elapsedMinutes, targetMinutes) => {
  if (!targetMinutes || targetMinutes <= 0) {
    return 0;
  }
  return Math.min(999, Math.round((elapsedMinutes / targetMinutes) * 100));
};

module.exports = {
  addSlaMinutes,
  elapsedSlaMinutes,
  percentConsumed,
  zonedParts
};
