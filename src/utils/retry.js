import logger from "./logger.js";

/**
 * Exponential backoff with jitter.
 *
 * @param {Function} fn         - Async function to execute
 * @param {object}   opts
 * @param {number}   opts.maxRetries   - Maximum retry attempts (default 5)
 * @param {number}   opts.baseDelayMs  - Base delay in ms (default 1000)
 * @param {number}   opts.maxDelayMs   - Cap delay in ms (default 60000)
 * @param {string}   [opts.label]      - Label for logs
 * @returns {Promise<*>}
 */
async function retryWithBackoff(fn, opts = {}) {
  const {
    maxRetries = 5,
    baseDelayMs = 1000,
    maxDelayMs = 60000,
    label = "operation",
  } = opts;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxRetries) {
        logger.error(`[Retry] ${label} failed after ${maxRetries + 1} attempts`, {
          error: err.message,
        });
        throw err;
      }

      // Exponential backoff: baseDelay * 2^attempt + random jitter
      const exponential = baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * baseDelayMs;
      const delay = Math.min(exponential + jitter, maxDelayMs);

      logger.warn(
        `[Retry] ${label} attempt ${attempt + 1}/${maxRetries + 1} failed, ` +
          `retrying in ${Math.round(delay)}ms — ${err.message}`
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { retryWithBackoff, sleep };
