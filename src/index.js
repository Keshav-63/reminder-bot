import logger from "./utils/logger.js";
import { startScheduler, stopScheduler } from "./scheduler.js";
import { startServer } from "./server.js";
import { verifyTransporter } from "./service/email.service.js";

// ─── Banner ──────────────────────────────────────────────────────────────────

logger.info("╔══════════════════════════════════════════════════╗");
logger.info("║          REMINDER BOT  —  Production            ║");
logger.info("╚══════════════════════════════════════════════════╝");

// ─── Startup ─────────────────────────────────────────────────────────────────

(async () => {
  try {
    // 1. Verify SMTP connection
    const smtpOk = await verifyTransporter();
    if (!smtpOk) {
      logger.warn("SMTP verification failed — emails may fail at runtime");
    }

    // 2. Start health/status HTTP server (required for free-tier PaaS)
    startServer();

    // 3. Start cron scheduler
    startScheduler();

    logger.info("Reminder Bot is running ✓");
  } catch (err) {
    logger.error(`Fatal startup error: ${err.message}`, { stack: err.stack });
    process.exit(1);
  }
})();

// ─── Graceful Shutdown ──────────────────────────────────────────────────────

function shutdown(signal) {
  logger.info(`Received ${signal} — shutting down gracefully...`);
  stopScheduler();
  // Give in-flight emails a few seconds to finish
  setTimeout(() => {
    logger.info("Shutdown complete");
    process.exit(0);
  }, 5000);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
});

process.on("uncaughtException", (err) => {
  logger.error(`Uncaught exception: ${err.message}`, { stack: err.stack });
  // In production, let the process manager restart us
  process.exit(1);
});