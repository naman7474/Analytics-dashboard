export const IST_TIME_ZONE = "Asia/Kolkata";

function getFormatter() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatParts(date: Date) {
  const parts = getFormatter().formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to format IST date parts.");
  }

  return { year, month, day };
}

function parseISODate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function toUTCDate(value: string) {
  const { year, month, day } = parseISODate(value);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatUTCDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getISTToday() {
  const { year, month, day } = formatParts(new Date());
  return `${year}-${month}-${day}`;
}

export function toISTISODate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const { year, month, day } = formatParts(date);
  return `${year}-${month}-${day}`;
}

export function addDaysToISODate(value: string, days: number) {
  const date = toUTCDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatUTCDate(date);
}

export function differenceInISODays(later: string, earlier: string) {
  const laterDate = toUTCDate(later);
  const earlierDate = toUTCDate(earlier);
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((laterDate.getTime() - earlierDate.getTime()) / dayMs);
}
