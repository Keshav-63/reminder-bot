import config from "../config.js";
import logger from "../utils/logger.js";
import { getToday, isWeekend, calculateDaysOverdue, parseDateSafe, nowIST, formatDateHuman } from "../utils/date.js";
import { fetchTasksBatched, batchUpdateLastReminded } from "./sheet.service.js";
import { enqueueEmail, drainEmailQueue } from "./email.service.js";
import { buildReminderHtml, buildUrgentHtml } from "./email.templates.js";

// ─── Email Builder ──────────────────────────────────────────────────────────

function buildReminderEmail({ taskName, ownerEmail, daysOverdue, dueDate }) {
  const dueDateFormatted = formatDateHuman(dueDate);

  if (daysOverdue === 0) {
    return {
      to: ownerEmail,
      subject: `⏰ Reminder: "${taskName}" is due today`,
      text:
        `Hi,\n\n` +
        `This is a friendly reminder that your task "${taskName}" is due TODAY (${dueDateFormatted}).\n\n` +
        `Please complete it at your earliest convenience.\n\n` +
        `— Reminder Bot`,
      html: buildReminderHtml({ taskName, ownerEmail, dueDateFormatted }),
      meta: { type: "reminder", daysOverdue: 0 },
    };
  }

  // Overdue
  return {
    to: ownerEmail,
    cc: config.email.managerEmail,
    subject: `🚨 URGENT: "${taskName}" is overdue by ${daysOverdue} day(s)`,
    text:
      `Hi,\n\n` +
      `Your task "${taskName}" is OVERDUE by ${daysOverdue} day(s).\n` +
      `Original due date: ${dueDateFormatted}\n\n` +
      `Please address this immediately.\n\n` +
      `This email has been CC'd to the manager for visibility.\n\n` +
      `— Reminder Bot`,
    html: buildUrgentHtml({ taskName, ownerEmail, daysOverdue, dueDateFormatted }),
    meta: { type: "urgent", daysOverdue },
  };
}

// ─── Process a Single Sheet ─────────────────────────────────────────────────

/**
 * Process one specific sheet inside one specific spreadsheet.
 * Returns partial stats + updates array.
 */
async function processOneSheet({ spreadsheetId, sheetName, today, runTimestamp, cols }) {
  const stats = {
    tasksScanned: 0,
    tasksEligible: 0,
    tasksSkippedCompleted: 0,
    tasksSkippedFuture: 0,
    tasksSkippedDedup: 0,
    tasksSkippedBadData: 0,
  };
  const updates = []; // { rowIndex, value }

  logger.info(`──── Processing: spreadsheet=${spreadsheetId.slice(0, 12)}… sheet="${sheetName}" ────`);

  for await (const { rows, batchNumber } of fetchTasksBatched({ spreadsheetId, sheetName })) {
    logger.info(`[${sheetName}] Processing batch ${batchNumber} (${rows.length} rows)`);

    for (const { row, rowIndex } of rows) {
      stats.tasksScanned++;

      const taskName = (row[cols.taskName] || "").trim();
      const ownerEmail = (row[cols.ownerEmail] || "").trim();
      const dueDateStr = (row[cols.dueDate] || "").trim();
      const status = (row[cols.status] || "").trim();
      const lastReminded = (row[cols.lastReminded] || "").trim();

      // ── Validation ──
      if (!taskName || !ownerEmail) {
        stats.tasksSkippedBadData++;
        continue;
      }

      // Skip completed tasks
      if (/^completed$/i.test(status)) {
        stats.tasksSkippedCompleted++;
        continue;
      }

      // Parse due date
      const dueDate = parseDateSafe(dueDateStr, config.timezone);
      if (!dueDate) {
        logger.warn(`[${sheetName}] Row ${rowIndex}: unparseable due date "${dueDateStr}" — skipping`);
        stats.tasksSkippedBadData++;
        continue;
      }

      // Skip future tasks
      if (dueDate > today) {
        stats.tasksSkippedFuture++;
        continue;
      }

      // Deduplication: skip if already reminded today
      if (config.dedup.preventSameDayDuplicates && lastReminded) {
        const lastDate = parseDateSafe(lastReminded, config.timezone);
        if (lastDate && lastDate.equals(today)) {
          stats.tasksSkippedDedup++;
          continue;
        }
      }

      // ── Build & enqueue email ──
      const daysOverdue = calculateDaysOverdue(dueDate, today);
      const emailPayload = buildReminderEmail({ taskName, ownerEmail, daysOverdue, dueDate });
      enqueueEmail(emailPayload);
      stats.tasksEligible++;

      // Track row for "Last Reminded" update (IST timestamp)
      updates.push({ rowIndex, value: runTimestamp });
    }
  }

  return { stats, updates };
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Main entry: iterate all configured spreadsheets & sheets,
 * enqueue emails, drain, write back IST timestamps.
 */
async function processReminders() {
  const today = getToday(config.timezone);
  // "Last Reminded" is always written in Indian Standard Time
  const runTimestamp = nowIST();

  // Weekend guard
  if (config.skipWeekends && isWeekend(today)) {
    logger.info("Weekend detected — skipping reminders.");
    return { skipped: true, reason: "weekend", emailsSent: 0, emailsFailed: 0 };
  }

  logger.info(`Starting reminder run — today is ${today.toISODate()}`);
  logger.info(`Configured spreadsheets: ${config.spreadsheets.length}, total sheets: ${config.spreadsheets.reduce((sum, s) => sum + s.sheets.length, 0)}`);

  const cols = config.columns;

  // Accumulate per-sheet updates grouped by spreadsheetId + sheetName
  const sheetUpdates = []; // { spreadsheetId, sheetName, updates[] }

  let totalScanned = 0;
  let totalEligible = 0;
  let totalSkippedCompleted = 0;
  let totalSkippedFuture = 0;
  let totalSkippedDedup = 0;
  let totalSkippedBadData = 0;

  // ── Iterate all spreadsheets & sheets ──
  for (const spreadsheet of config.spreadsheets) {
    for (const sheetName of spreadsheet.sheets) {
      try {
        const { stats, updates } = await processOneSheet({
          spreadsheetId: spreadsheet.id,
          sheetName,
          today,
          runTimestamp,
          cols,
        });

        totalScanned += stats.tasksScanned;
        totalEligible += stats.tasksEligible;
        totalSkippedCompleted += stats.tasksSkippedCompleted;
        totalSkippedFuture += stats.tasksSkippedFuture;
        totalSkippedDedup += stats.tasksSkippedDedup;
        totalSkippedBadData += stats.tasksSkippedBadData;

        if (updates.length > 0) {
          sheetUpdates.push({
            spreadsheetId: spreadsheet.id,
            sheetName,
            updates,
          });
        }
      } catch (err) {
        logger.error(`Error processing spreadsheet=${spreadsheet.id} sheet="${sheetName}": ${err.message}`);
        // Continue with next sheet instead of aborting entire run
      }
    }
  }

  logger.info(
    `Scan complete — ${totalScanned} rows scanned across all sheets, ${totalEligible} emails enqueued, ` +
      `${totalSkippedCompleted} completed, ${totalSkippedFuture} future, ` +
      `${totalSkippedDedup} deduped, ${totalSkippedBadData} bad data`
  );

  // ── Drain the email queue ──
  let emailResults = { sent: 0, failed: 0, errors: [] };
  if (totalEligible > 0) {
    logger.info(`Waiting for ${totalEligible} emails to send...`);
    emailResults = await drainEmailQueue();
    logger.info(`Emails done — ${emailResults.sent} sent, ${emailResults.failed} failed`);
  }

  // ── Write "Last Reminded" IST timestamps back to each sheet ──
  for (const { spreadsheetId, sheetName, updates } of sheetUpdates) {
    logger.info(`Updating "Last Reminded" for ${updates.length} rows in "${sheetName}"...`);
    try {
      await batchUpdateLastReminded({ spreadsheetId, sheetName, updates });
      logger.info(`[${sheetName}] "Last Reminded" column updated successfully`);
    } catch (err) {
      logger.error(`[${sheetName}] Failed to update "Last Reminded": ${err.message}`);
    }
  }

  const summary = {
    skipped: false,
    date: today.toISODate(),
    spreadsheetsProcessed: config.spreadsheets.length,
    sheetsProcessed: config.spreadsheets.reduce((sum, s) => sum + s.sheets.length, 0),
    tasksScanned: totalScanned,
    tasksEligible: totalEligible,
    tasksSkippedCompleted: totalSkippedCompleted,
    tasksSkippedFuture: totalSkippedFuture,
    tasksSkippedDedup: totalSkippedDedup,
    tasksSkippedBadData: totalSkippedBadData,
    emailsSent: emailResults.sent,
    emailsFailed: emailResults.failed,
    emailErrors: emailResults.errors,
    lastRemindedTimezone: "Asia/Kolkata (IST)",
  };

  logger.info("Run summary", summary);
  return summary;
}

export { processReminders };