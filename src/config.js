import "dotenv/config";

/**
 * Validated application configuration.
 * All environment variables are parsed and validated at startup.
 * Missing required vars will cause a clear error message.
 */

const REQUIRED_ENV = [
  "SPREADSHEETS",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "MAIL_USER",
  "MAIL_PASS",
];

function validateEnv() {
  // Support legacy single-sheet SPREADSHEET_ID as well
  if (!process.env.SPREADSHEETS && !process.env.SPREADSHEET_ID) {
    throw new Error(
      `Missing SPREADSHEETS (or legacy SPREADSHEET_ID) environment variable.\n` +
        `Set SPREADSHEETS as a JSON array, e.g.:\n` +
        `SPREADSHEETS=[{"id":"abc123","sheets":["Sheet1","Sheet2"]},{"id":"xyz789","sheets":["Tasks"]}]`
    );
  }

  const missing = REQUIRED_ENV.filter((key) => {
    if (key === "SPREADSHEETS") return !process.env.SPREADSHEETS && !process.env.SPREADSHEET_ID;
    return !process.env[key];
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        `Please check your .env file or environment configuration.`
    );
  }
}

validateEnv();

/**
 * Parse the SPREADSHEETS env var.
 *
 * Supports two formats:
 *  1. New JSON array:  SPREADSHEETS=[{"id":"abc","sheets":["Sheet1","Sheet2"]}]
 *  2. Legacy single:   SPREADSHEET_ID=abc  +  SHEET_NAME=Sheet1
 *
 * Returns: Array<{ id: string, sheets: string[] }>
 */
function parseSpreadsheets() {
  if (process.env.SPREADSHEETS) {
    try {
      const parsed = JSON.parse(process.env.SPREADSHEETS);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("SPREADSHEETS must be a non-empty JSON array");
      }
      return parsed.map((entry) => {
        if (typeof entry === "string") {
          // Simple format: just spreadsheet IDs with default sheet
          return { id: entry, sheets: [process.env.SHEET_NAME || "Sheet1"] };
        }
        if (!entry.id) throw new Error(`Each SPREADSHEETS entry must have an "id" field`);
        return {
          id: entry.id,
          sheets: Array.isArray(entry.sheets) && entry.sheets.length > 0
            ? entry.sheets
            : [process.env.SHEET_NAME || "Sheet1"],
        };
      });
    } catch (err) {
      if (err instanceof SyntaxError) {
        // Maybe it's a comma-separated list of IDs
        return process.env.SPREADSHEETS.split(",").map((id) => ({
          id: id.trim(),
          sheets: (process.env.SHEET_NAME || "Sheet1").split(",").map((s) => s.trim()),
        }));
      }
      throw err;
    }
  }

  // Legacy fallback
  return [{
    id: process.env.SPREADSHEET_ID,
    sheets: (process.env.SHEET_NAME || "Sheet1").split(",").map((s) => s.trim()),
  }];
}

const config = {
  // ─── Google Sheets (multi-spreadsheet, multi-sheet) ───────────────
  spreadsheets: parseSpreadsheets(),

  google: {
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  },

  // ─── Columns (0-indexed positions in the sheet) ──────────────────
  columns: {
    taskName: 0,     // A
    ownerEmail: 1,   // B
    dueDate: 2,      // C
    status: 3,       // D
    lastReminded: 4, // E  (auto-created if missing)
  },

  // ─── Batching ────────────────────────────────────────────────────
  batch: {
    sheetReadSize: parseInt(process.env.SHEET_BATCH_SIZE, 10) || 5000,
    sheetWriteSize: parseInt(process.env.SHEET_WRITE_BATCH_SIZE, 10) || 500,
  },

  // ─── Email ────────────────────────────────────────────────────────
  email: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
    service: process.env.MAIL_SERVICE || "gmail",
    host: process.env.MAIL_HOST || undefined,
    port: parseInt(process.env.MAIL_PORT, 10) || undefined,
    secure: process.env.MAIL_SECURE === "true",
    fromName: process.env.MAIL_FROM_NAME || "Reminder Bot",
    managerEmail: process.env.MANAGER_EMAIL || process.env.MAIL_USER,
  },

  // ─── Queue ────────────────────────────────────────────────────────
  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY, 10) || 5,
    maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES, 10) || 5,
    baseDelayMs: parseInt(process.env.QUEUE_BASE_DELAY_MS, 10) || 1000,
    maxDelayMs: parseInt(process.env.QUEUE_MAX_DELAY_MS, 10) || 60000,
  },

  // ─── Scheduler ────────────────────────────────────────────────────
  timezone: process.env.TIMEZONE || "Asia/Kolkata",
  cronSchedule: process.env.CRON_SCHEDULE || "0 9 * * 1-5", // 9 AM weekdays
  skipWeekends: process.env.SKIP_WEEKENDS !== "false",       // default true
  runOnStartup: process.env.RUN_ON_STARTUP === "true",       // default false

  // ─── Timestamp ────────────────────────────────────────────────────
  // "Last Reminded" column always written in Indian Standard Time
  lastRemindedTimezone: "Asia/Kolkata",

  // ─── Server ───────────────────────────────────────────────────────
  port: parseInt(process.env.PORT, 10) || 7860, // 7860 = Hugging Face default

  // ─── Logging ──────────────────────────────────────────────────────
  log: {
    level: process.env.LOG_LEVEL || "info",
    dir: process.env.LOG_DIR || "logs",
    maxSize: process.env.LOG_MAX_SIZE || "20m",
    maxFiles: process.env.LOG_MAX_FILES || "14d",
  },

  // ─── Deduplication ────────────────────────────────────────────────
  dedup: {
    preventSameDayDuplicates: process.env.DEDUP_SAME_DAY !== "false",
  },
};

export default config;