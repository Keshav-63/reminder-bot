import http from "http";
import config from "./config.js";
import logger from "./utils/logger.js";
import { getSchedulerStatus, runOnce } from "./scheduler.js";
import { emailQueueStats } from "./service/email.service.js";

/**
 * Minimal HTTP server for:
 *  - Health checks (required by Hugging Face Spaces, Railway, Render, etc.)
 *  - Manual trigger endpoint
 *  - Status/metrics endpoint
 */
function startServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    try {
      switch (url.pathname) {
        // ── Health check ─────────────────────────────────────────
        case "/":
        case "/health": {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              status: "ok",
              service: "reminder-bot",
              uptime: process.uptime(),
              timestamp: new Date().toISOString(),
            })
          );
          break;
        }

        // ── Status / Metrics ─────────────────────────────────────
        case "/status": {
          const scheduler = getSchedulerStatus();
          const queue = emailQueueStats();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              status: "ok",
              scheduler,
              emailQueue: queue,
              memory: process.memoryUsage(),
              uptime: process.uptime(),
            })
          );
          break;
        }

        // ── Manual trigger ───────────────────────────────────────
        case "/trigger": {
          if (req.method !== "POST") {
            res.writeHead(405, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Use POST to trigger a run" }));
            break;
          }
          logger.info("Manual trigger received via /trigger endpoint");
          // Run asynchronously, return immediately
          runOnce().catch((err) =>
            logger.error(`Manual trigger error: ${err.message}`)
          );
          res.writeHead(202, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: "Reminder run triggered" }));
          break;
        }

        // ── 404 ──────────────────────────────────────────────────
        default: {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Not found" }));
        }
      }
    } catch (err) {
      logger.error(`HTTP handler error: ${err.message}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  });

  server.listen(config.port, "0.0.0.0", () => {
    logger.info(`Health server listening on http://0.0.0.0:${config.port}`);
    logger.info(`  GET  /health  — health check`);
    logger.info(`  GET  /status  — scheduler & queue status`);
    logger.info(`  POST /trigger — manually trigger a run`);
  });

  return server;
}

export { startServer };
