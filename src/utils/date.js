import { DateTime } from "luxon";

/**
 * Get today's date (start of day) in the given timezone.
 * @param {string} timezone - IANA timezone string
 * @returns {DateTime}
 */
function getToday(timezone) {
  return DateTime.now().setZone(timezone).startOf("day");
}

/**
 * Check if a DateTime falls on a weekend (Saturday = 6, Sunday = 7 in Luxon).
 * @param {DateTime} dateTime
 * @returns {boolean}
 */
function isWeekend(dateTime) {
  return dateTime.weekday === 6 || dateTime.weekday === 7;
}

/**
 * Calculate the number of whole days a task is overdue.
 * Returns 0 if the due date is today, negative if in the future.
 * @param {DateTime} dueDate
 * @param {DateTime} today
 * @returns {number}
 */
function calculateDaysOverdue(dueDate, today) {
  return Math.floor(today.diff(dueDate, "days").days);
}

/**
 * Safely parse a date string into a Luxon DateTime (start of day).
 * Supports ISO dates, US-style dates, and most common formats.
 * Returns null if unparseable.
 * @param {string} dateStr
 * @param {string} timezone
 * @returns {DateTime|null}
 */
function parseDateSafe(dateStr, timezone) {
  if (!dateStr || typeof dateStr !== "string") return null;

  const trimmed = dateStr.trim();

  // Try ISO first
  let dt = DateTime.fromISO(trimmed, { zone: timezone });
  if (dt.isValid) return dt.startOf("day");

  // Try common formats
  const formats = [
    "MM/dd/yyyy",
    "dd/MM/yyyy",
    "yyyy-MM-dd",
    "M/d/yyyy",
    "d/M/yyyy",
    "MM-dd-yyyy",
    "dd-MM-yyyy",
    "MMMM d, yyyy",
    "MMM d, yyyy",
  ];

  for (const fmt of formats) {
    dt = DateTime.fromFormat(trimmed, fmt, { zone: timezone });
    if (dt.isValid) return dt.startOf("day");
  }

  // Last resort: JS Date constructor
  const jsDate = new Date(dateStr);
  if (!isNaN(jsDate.getTime())) {
    return DateTime.fromJSDate(jsDate, { zone: timezone }).startOf("day");
  }

  return null;
}

/**
 * Format a DateTime for display in the sheet (ISO string).
 * @param {string} timezone
 * @returns {string}
 */
function nowISO(timezone) {
  return DateTime.now().setZone(timezone).toISO();
}

/**
 * Get current timestamp formatted for Indian Standard Time.
 * Format: "25 Feb 2026, 02:30 PM IST"
 * @returns {string}
 */
function nowIST() {
  return DateTime.now()
    .setZone("Asia/Kolkata")
    .toFormat("dd MMM yyyy, hh:mm a") + " IST";
}

/**
 * Format a Luxon DateTime for human-readable display.
 * @param {DateTime} dt
 * @returns {string} e.g. "25 Feb 2026"
 */
function formatDateHuman(dt) {
  if (!dt || !dt.isValid) return "N/A";
  return dt.toFormat("dd MMM yyyy");
}

export {
  getToday,
  isWeekend,
  calculateDaysOverdue,
  parseDateSafe,
  nowISO,
  nowIST,
  formatDateHuman,
};