import { TZDate } from "@date-fns/tz";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { APP_TIMEZONE } from "./env";

export function nowInAppZone() {
  return new TZDate(new Date(), APP_TIMEZONE);
}

export function parseYearMonth(value?: string) {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    return new TZDate(year, month - 1, 1, APP_TIMEZONE);
  }

  const now = nowInAppZone();
  return new TZDate(now.getFullYear(), now.getMonth(), 1, APP_TIMEZONE);
}

export function yearMonthKey(date: Date) {
  return format(new TZDate(date, APP_TIMEZONE), "yyyy-MM");
}

export function dayKey(date: Date) {
  return format(new TZDate(date, APP_TIMEZONE), "yyyy-MM-dd");
}

export function latestSessionDay(days: string[], today = dayKey(nowInAppZone())) {
  const unique = [...new Set(days)].sort();
  if (unique.length === 0) {
    return undefined;
  }

  return unique.filter((day) => day <= today).at(-1) ?? unique.at(-1);
}

export function monthRange(yearMonth: Date) {
  const start = startOfMonth(yearMonth);
  const end = endOfMonth(yearMonth);
  return {
    start: new TZDate(start, APP_TIMEZONE),
    end: new TZDate(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999, APP_TIMEZONE),
  };
}

export function calendarGrid(yearMonth: Date) {
  const start = startOfWeek(startOfMonth(yearMonth), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(yearMonth), { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end }).map(
    (date) => new TZDate(date, APP_TIMEZONE),
  );
}

export function adjacentMonth(yearMonth: Date, offset: number) {
  return addMonths(yearMonth, offset);
}

export function formatGameWhen(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatGameDay(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatNextDownloadWhen(at: Date, now = new Date()) {
  const then = dayKey(at);
  if (then <= dayKey(now)) {
    return "later today";
  }

  const zone = new TZDate(now, APP_TIMEZONE);
  const tomorrow = new TZDate(zone.getFullYear(), zone.getMonth(), zone.getDate() + 1, APP_TIMEZONE);
  if (then === format(tomorrow, "yyyy-MM-dd")) {
    return "tomorrow";
  }

  return format(new TZDate(at, APP_TIMEZONE), "EEEE");
}

export function formatDuration(durationMs?: number | null) {
  if (!durationMs || durationMs < 0) {
    return "";
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function toDatetimeLocalValue(date: Date) {
  return format(new TZDate(date, APP_TIMEZONE), "yyyy-MM-dd'T'HH:mm");
}

export function fromDatetimeLocalValue(value: string) {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return new TZDate(year, month - 1, day, hour, minute, 0, APP_TIMEZONE);
}

export { APP_TIMEZONE };
