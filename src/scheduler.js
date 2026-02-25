import cron from "node-cron";
import config from "./config.js";
import logger from "./utils/logger.js";
import { processReminders } from "./service/reminder.service.js";

let _job = null;
let _running = false;
let _lastRun = null;
let _lastResult = null;

/**
 * Execute one reminder run. Guards against overlapping runs.
 */
async function runOnce() {
  if (_running) {
    logger.warn("Previous run still in progress — skipping overlapping invocation");
    return null;
  }

  _running = true;
  const start = Date.now();

  try {
    logger.info("═══════════════════════════════════════════════════");
    logger.info("Reminder job started");
    const result = await processReminders();
    _lastResult = result;
    _lastRun = new Date().toISOString();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    logger.info(`Reminder job completed in ${elapsed}s`);
    logger.info("═══════════════════════════════════════════════════");
    return result;
  } catch (err) {
    logger.error(`Reminder job crashed: ${err.message}`, { stack: err.stack });
    _lastResult = { error: err.message };
    return null;
  } finally {
    _running = false;
  }
}

/**
 * Start the cron scheduler.
 */
function startScheduler() {
  const schedule = config.cronSchedule;

  if (!cron.validate(schedule)) {
    throw new Error(`Invalid cron expression: "${schedule}"`);
  }

  logger.info(`Scheduling reminder job: "${schedule}" (tz: ${config.timezone})`);

  _job = cron.schedule(
    schedule,
    () => {
      runOnce().catch((err) =>
        logger.error(`Unhandled scheduler error: ${err.message}`)
      );
    },
    { timezone: config.timezone }
  );

  // Optionally run immediately on startup
  if (config.runOnStartup) {
    logger.info("RUN_ON_STARTUP=true — triggering immediate run");
    runOnce().catch((err) =>
      logger.error(`Startup run error: ${err.message}`)
    );
  }
}

/**
 * Stop the cron scheduler gracefully.
 */
function stopScheduler() {
  if (_job) {
    _job.stop();
    logger.info("Scheduler stopped");
  }
}

/**
 * Get scheduler status (used by health endpoint).
 */
function getSchedulerStatus() {
  return {
    running: _running,
    lastRun: _lastRun,
    lastResult: _lastResult,
    cronSchedule: config.cronSchedule,
    timezone: config.timezone,
  };
}

export { startScheduler, stopScheduler, runOnce, getSchedulerStatus };