import "server-only";
import type { BusinessHours, Weekday } from "@velobot/shared";

const WEEKDAY_ORDER: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Null config = always available (today's default behavior, unchanged for every bot until an admin opts in). */
export function isWithinBusinessHours(hours: BusinessHours | null, now: Date = new Date()): boolean {
  if (!hours) return true;

  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: hours.timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    // An invalid/unrecognized timezone string shouldn't take the whole
    // widget-config route down — fail open (always available) rather than
    // 500ing every widget load for every visitor of this bot.
    return true;
  }

  const weekdayShort = parts.find((p) => p.type === "weekday")?.value?.toLowerCase().slice(0, 3);
  const hour = parts.find((p) => p.type === "hour")?.value;
  const minute = parts.find((p) => p.type === "minute")?.value;
  const day = WEEKDAY_ORDER.find((d) => d === weekdayShort);
  if (!day || hour === undefined || minute === undefined) return true;

  const today = hours.days[day];
  if (!today) return false;

  const nowMinutes = Number(hour) * 60 + Number(minute);
  const [openH = 0, openM = 0] = today.open.split(":").map(Number);
  const [closeH = 0, closeM = 0] = today.close.split(":").map(Number);
  return nowMinutes >= openH * 60 + openM && nowMinutes < closeH * 60 + closeM;
}
