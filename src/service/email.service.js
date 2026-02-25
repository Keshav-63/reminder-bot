import nodemailer from "nodemailer";
import config from "../config.js";
import logger from "../utils/logger.js";
import { retryWithBackoff } from "../utils/retry.js";
import { AsyncQueue } from "../utils/queue.js";

// ─── Transporter ────────────────────────────────────────────────────────────

function createTransporter() {
  const opts = {
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
    // Connection pool for high-volume sending
    pool: true,
    maxConnections: config.queue.concurrency,
    maxMessages: 100, // per connection before recycling
    // Timeouts
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  };

  if (config.email.host) {
    // Custom SMTP
    opts.host = config.email.host;
    opts.port = config.email.port || 587;
    opts.secure = config.email.secure;
  } else {
    // Named service (gmail, outlook, etc.)
    opts.service = config.email.service;
  }

  return nodemailer.createTransport(opts);
}

let transporter = createTransporter();

/**
 * Verify the SMTP connection is working. Called once at startup.
 */
async function verifyTransporter() {
  try {
    await transporter.verify();
    logger.info("SMTP transporter verified — connection OK");
    return true;
  } catch (err) {
    logger.error(`SMTP verification failed: ${err.message}`);
    return false;
  }
}

// ─── Email Queue ────────────────────────────────────────────────────────────

const emailQueue = new AsyncQueue({
  concurrency: config.queue.concurrency,
  name: "email",
});

// Track results for the current run
let _runResults = { sent: 0, failed: 0, errors: [] };

emailQueue.process(async (job) => {
  const { to, subject, text, html, cc, meta } = job;

  await retryWithBackoff(
    async () => {
      await transporter.sendMail({
        from: `"${config.email.fromName}" <${config.email.user}>`,
        to,
        cc: cc || undefined,
        subject,
        text,
        html: html || undefined,
      });
    },
    {
      maxRetries: config.queue.maxRetries,
      baseDelayMs: config.queue.baseDelayMs,
      maxDelayMs: config.queue.maxDelayMs,
      label: `email→${to}`,
    }
  );

  _runResults.sent++;
  logger.info(`Email sent to ${to}`, { subject, ...(meta || {}) });
});

emailQueue.on("failed", (job, err) => {
  _runResults.failed++;
  _runResults.errors.push({ to: job.to, error: err.message });
  logger.error(`Email permanently failed for ${job.to}: ${err.message}`);
});

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Enqueue an email to be sent.
 * @param {object} emailObj
 * @param {string} emailObj.to
 * @param {string} emailObj.subject
 * @param {string} emailObj.text
 * @param {string} [emailObj.html]
 * @param {string} [emailObj.cc]
 * @param {object} [emailObj.meta] - extra data for logging
 */
function enqueueEmail(emailObj) {
  emailQueue.push(emailObj);
}

/**
 * Wait for all currently enqueued emails to finish sending.
 * Returns { sent, failed, errors }.
 */
async function drainEmailQueue() {
  await emailQueue.drain();
  const results = { ..._runResults };
  // Reset for next run
  _runResults = { sent: 0, failed: 0, errors: [] };
  return results;
}

/**
 * Get current queue stats.
 */
function emailQueueStats() {
  return emailQueue.stats();
}

export {
  enqueueEmail,
  drainEmailQueue,
  verifyTransporter,
  emailQueueStats,
};