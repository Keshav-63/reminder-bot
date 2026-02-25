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

  let trimmed = dateStr.trim();

  // Strip trailing timezone abbreviations (" IST", " UTC", " GMT+5:30", etc.)
  trimmed = trimmed.replace(/\s+(IST|UTC|GMT(?:[+-]\d{1,2}:?\d{0,2})?)$/i, "");

  // ── Google Sheets serial date number (e.g. 44927 = 2023-01-01) ──
  if (/^\d{5}$/.test(trimmed)) {
    const serial = parseInt(trimmed, 10);
    // Google Sheets epoch: 30 Dec 1899 (with the Lotus 1-2-3 leap year bug)
    const epoch = DateTime.fromObject({ year: 1899, month: 12, day: 30 }, { zone: timezone });
    const dt = epoch.plus({ days: serial });
    if (dt.isValid) return dt.startOf("day");
  }

  // ── ISO 8601 (yyyy-MM-dd, yyyy-MM-ddTHH:mm, etc.) ──
  let dt = DateTime.fromISO(trimmed, { zone: timezone });
  if (dt.isValid) return dt.startOf("day");

  // ── Explicit formats — ordered from most specific to least specific ──
  // Covers: 4-digit year, 2-digit year, slash/dash/dot separators,
  //         named months (full & abbreviated), with & without time
  const formats = [
    // ─ Timestamp written by nowIST() ─
    "dd MMM yyyy, hh:mm a",
    "dd MMM yyyy, HH:mm",

    // ─ 4-digit year — slash separator ─
    "MM/dd/yyyy",          // 02/25/2026
    "dd/MM/yyyy",          // 25/02/2026
    "M/d/yyyy",            // 2/5/2026
    "d/M/yyyy",            // 5/2/2026
    "yyyy/MM/dd",          // 2026/02/25

    // ─ 4-digit year — dash separator ─
    "MM-dd-yyyy",          // 02-25-2026
    "dd-MM-yyyy",          // 25-02-2026
    "yyyy-MM-dd",          // 2026-02-25

    // ─ 4-digit year — dot separator ─
    "dd.MM.yyyy",          // 25.02.2026
    "MM.dd.yyyy",          // 02.25.2026
    "yyyy.MM.dd",          // 2026.02.25

    // ─ 2-digit year — slash separator ─
    "MM/dd/yy",            // 02/25/26
    "dd/MM/yy",            // 25/02/26
    "M/d/yy",              // 2/5/26
    "d/M/yy",              // 5/2/26

    // ─ 2-digit year — dash separator ─
    "MM-dd-yy",            // 02-25-26
    "dd-MM-yy",            // 25-02-26

    // ─ 2-digit year — dot separator ─
    "dd.MM.yy",            // 25.02.26
    "MM.dd.yy",            // 02.25.26

    // ─ Named months (full) ─
    "MMMM d, yyyy",        // February 25, 2026
    "d MMMM yyyy",         // 25 February 2026
    "MMMM dd, yyyy",       // February 05, 2026
    "dd MMMM yyyy",        // 05 February 2026
    "yyyy MMMM dd",        // 2026 February 25

    // ─ Named months (abbreviated) ─
    "MMM d, yyyy",         // Feb 25, 2026
    "d MMM yyyy",          // 25 Feb 2026
    "dd MMM yyyy",         // 05 Feb 2026
    "MMM dd, yyyy",        // Feb 05, 2026
    "dd-MMM-yyyy",         // 25-Feb-2026
    "dd-MMM-yy",           // 25-Feb-26

    // ─ Date with time (common in sheets with datetime values) ─
    "MM/dd/yyyy HH:mm:ss",
    "dd/MM/yyyy HH:mm:ss",
    "MM/dd/yyyy hh:mm:ss a",
    "dd/MM/yyyy hh:mm:ss a",
    "yyyy-MM-dd HH:mm:ss",
    "dd-MM-yyyy HH:mm:ss",
    "MM-dd-yyyy HH:mm:ss",
    "dd.MM.yyyy HH:mm:ss",

    // ─ Date with time (no seconds) ─
    "MM/dd/yyyy HH:mm",
    "dd/MM/yyyy HH:mm",
    "yyyy-MM-dd HH:mm",
    "dd-MM-yyyy HH:mm",
  ];

  for (const fmt of formats) {
    dt = DateTime.fromFormat(trimmed, fmt, { zone: timezone });
    if (dt.isValid) return dt.startOf("day");
  }

  // ── RFC 2822 (e.g. "Wed, 25 Feb 2026 10:30:00 +0530") ──
  dt = DateTime.fromRFC2822(trimmed, { zone: timezone });
  if (dt.isValid) return dt.startOf("day");

  // ── HTTP date (e.g. "Wed, 25 Feb 2026 10:30:00 GMT") ──
  dt = DateTime.fromHTTP(trimmed, { zone: timezone });
  if (dt.isValid) return dt.startOf("day");

  // ── Last resort: JS Date constructor (handles many locale strings) ──
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