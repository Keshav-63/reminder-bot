import { EventEmitter } from "events";
import logger from "./logger.js";

/**
 * Lightweight async task queue with concurrency control.
 * No external dependencies — works entirely in-process.
 *
 * Usage:
 *   const queue = new AsyncQueue({ concurrency: 5, name: "email" });
 *   queue.push({ data: ... });        // enqueue a job
 *   queue.process(async (job) => {});  // register worker
 *   await queue.drain();               // wait until all jobs are done
 */
class AsyncQueue extends EventEmitter {
  /**
   * @param {object}  opts
   * @param {number}  opts.concurrency - Max parallel workers (default 5)
   * @param {string}  opts.name        - Queue name for logging
   */
  constructor({ concurrency = 5, name = "queue" } = {}) {
    super();
    this.concurrency = concurrency;
    this.name = name;
    this._pending = [];         // waiting jobs
    this._active = 0;           // currently running
    this._worker = null;        // worker function
    this._totalEnqueued = 0;
    this._totalCompleted = 0;
    this._totalFailed = 0;
    this._drainResolvers = [];
    this._paused = false;
  }

  /**
   * Register the worker function called for each job.
   * @param {Function} fn - async (job) => void
   */
  process(fn) {
    if (typeof fn !== "function") {
      throw new TypeError("Worker must be a function");
    }
    this._worker = fn;
    // If jobs were pushed before process() was called, start them
    this._tick();
  }

  /**
   * Enqueue a job. If a worker is registered and slots are available,
   * processing starts immediately.
   * @param {*} job
   */
  push(job) {
    this._totalEnqueued++;
    this._pending.push(job);
    this._tick();
  }

  /**
   * Enqueue multiple jobs at once.
   * @param {Array} jobs
   */
  pushMany(jobs) {
    for (const job of jobs) {
      this.push(job);
    }
  }

  /**
   * Returns a promise that resolves when all enqueued jobs have completed
   * (or the queue is empty and no workers are active).
   * @returns {Promise<void>}
   */
  drain() {
    if (this._pending.length === 0 && this._active === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this._drainResolvers.push(resolve);
    });
  }

  /** Pause processing — active jobs will finish but no new ones start. */
  pause() {
    this._paused = true;
  }

  /** Resume processing. */
  resume() {
    this._paused = false;
    this._tick();
  }

  /** Get current queue statistics. */
  stats() {
    return {
      name: this.name,
      pending: this._pending.length,
      active: this._active,
      totalEnqueued: this._totalEnqueued,
      totalCompleted: this._totalCompleted,
      totalFailed: this._totalFailed,
    };
  }

  // ─── Internal ──────────────────────────────────────────────────────

  _tick() {
    if (!this._worker || this._paused) return;

    while (this._active < this.concurrency && this._pending.length > 0) {
      const job = this._pending.shift();
      this._active++;
      this._run(job);
    }
  }

  async _run(job) {
    try {
      await this._worker(job);
      this._totalCompleted++;
      this.emit("completed", job);
    } catch (err) {
      this._totalFailed++;
      this.emit("failed", job, err);
      logger.error(`[Queue:${this.name}] Job failed: ${err.message}`);
    } finally {
      this._active--;
      this._tick();
      this._checkDrain();
    }
  }

  _checkDrain() {
    if (this._pending.length === 0 && this._active === 0) {
      const resolvers = this._drainResolvers.splice(0);
      for (const resolve of resolvers) resolve();
      this.emit("drain");
    }
  }
}

export { AsyncQueue };
