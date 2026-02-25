import { google } from "googleapis";
import config from "../config.js";
import logger from "../utils/logger.js";
import { retryWithBackoff } from "../utils/retry.js";

// ─── Auth ────────────────────────────────────────────────────────────────────

const auth = new google.auth.JWT(
  config.google.serviceAccountEmail,
  null,
  config.google.privateKey,
  config.google.scopes
);

const sheets = google.sheets({ version: "v4", auth });

// ─── Column helpers ─────────────────────────────────────────────────────────

/**
 * Convert a 0-based column index to a Google Sheets column letter (A, B, ... Z, AA...).
 */
function colLetter(index) {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

// The "Last Reminded" column letter (E by default)
const LAST_REMINDED_COL = colLetter(config.columns.lastReminded);

// ─── Batched Read ───────────────────────────────────────────────────────────

/**
 * Fetch rows from a specific sheet in pages of `batchSize`.
 * Yields arrays of { row: string[], rowIndex: number } where rowIndex is 1-based.
 *
 * @param {object} opts
 * @param {string} opts.spreadsheetId  - Google spreadsheet ID (required)
 * @param {string} opts.sheetName      - Tab name inside the spreadsheet (required)
 * @param {number} [opts.batchSize]
 * @yields {{ rows: Array<{row: string[], rowIndex: number}>, batchNumber: number }}
 */
async function* fetchTasksBatched({
  spreadsheetId,
  sheetName,
  batchSize = config.batch.sheetReadSize,
}) {
  if (!spreadsheetId || !sheetName) {
    throw new Error("fetchTasksBatched requires both spreadsheetId and sheetName");
  }

  // First, get total row count from sheet metadata
  const meta = await retryWithBackoff(
    () =>
      sheets.spreadsheets.get({
        spreadsheetId,
        fields: "sheets(properties(title,gridProperties(rowCount)))",
      }),
    { maxRetries: 3, label: `sheets.meta [${sheetName}]` }
  );

  const sheetMeta = meta.data.sheets.find(
    (s) => s.properties.title === sheetName
  );

  if (!sheetMeta) {
    logger.warn(`Sheet "${sheetName}" not found in spreadsheet ${spreadsheetId} — skipping`);
    return;
  }

  const totalRows = sheetMeta.properties.gridProperties.rowCount;
  logger.info(`Sheet "${sheetName}" (${spreadsheetId.slice(0, 8)}…) has ${totalRows} rows`);

  let startRow = 2;
  let batchNumber = 0;

  while (startRow <= totalRows) {
    const endRow = Math.min(startRow + batchSize - 1, totalRows);
    const range = `'${sheetName}'!A${startRow}:${LAST_REMINDED_COL}${endRow}`;

    const res = await retryWithBackoff(
      () =>
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
          valueRenderOption: "FORMATTED_VALUE",
        }),
      { maxRetries: 3, label: `sheets.read [${sheetName}] batch ${batchNumber}` }
    );

    const rawRows = res.data.values || [];

    if (rawRows.length === 0) {
      startRow = endRow + 1;
      batchNumber++;
      continue;
    }

    const rows = rawRows.map((row, i) => ({
      row,
      rowIndex: startRow + i,
    }));

    batchNumber++;
    logger.debug(
      `[${sheetName}] Batch ${batchNumber}: read ${rows.length} rows (rows ${startRow}–${endRow})`
    );

    yield { rows, batchNumber };

    startRow = endRow + 1;
  }
}

// ─── Batched Write ──────────────────────────────────────────────────────────

/**
 * Write "Last Reminded" timestamps back to a specific sheet in batches.
 *
 * @param {object} opts
 * @param {string} opts.spreadsheetId
 * @param {string} opts.sheetName
 * @param {Array<{rowIndex: number, value: string}>} opts.updates
 */
async function batchUpdateLastReminded({ spreadsheetId, sheetName, updates }) {
  if (!updates || updates.length === 0) return;

  const writeBatch = config.batch.sheetWriteSize;

  for (let i = 0; i < updates.length; i += writeBatch) {
    const chunk = updates.slice(i, i + writeBatch);

    const data = chunk.map(({ rowIndex, value }) => ({
      range: `'${sheetName}'!${LAST_REMINDED_COL}${rowIndex}`,
      values: [[value]],
    }));

    await retryWithBackoff(
      () =>
        sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: "RAW",
            data,
          },
        }),
      { maxRetries: 3, label: `sheets.write [${sheetName}] chunk ${Math.floor(i / writeBatch) + 1}` }
    );

    logger.info(
      `[${sheetName}] Sheet write: updated ${chunk.length} rows (batch ${Math.floor(i / writeBatch) + 1})`
    );
  }
}

export { fetchTasksBatched, batchUpdateLastReminded, colLetter };