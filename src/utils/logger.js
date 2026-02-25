import { createLogger, format, transports } from "winston";
import path from "path";

// Lazy-load config to avoid circular dependency at module level
let _config = null;
async function getLogConfig() {
  if (!_config) {
    try {
      const { default: config } = await import("../config.js");
      _config = config.log;
    } catch {
      _config = { level: "info", dir: "logs", maxSize: "20m", maxFiles: "14d" };
    }
  }
  return _config;
}

const { combine, timestamp, printf, errors, colorize } = format;

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${timestamp} [${level}]${stack ? ` ${stack}` : ` ${message}`}${metaStr}`;
});

async function buildLogger() {
  const cfg = await getLogConfig();

  const logger = createLogger({
    level: cfg.level,
    format: combine(
      errors({ stack: true }),
      timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
      logFormat
    ),
    defaultMeta: { service: "reminder-bot" },
    transports: [
      // Console — always
      new transports.Console({
        format: combine(colorize(), logFormat),
      }),
    ],
    // Don't crash on logging errors
    exitOnError: false,
  });

  // File transports — only if we can write to disk
  try {
    const { default: DailyRotate } = await import("winston-daily-rotate-file");
    const logDir = path.resolve(process.cwd(), cfg.dir);

    logger.add(
      new DailyRotate({
        dirname: logDir,
        filename: "reminder-bot-%DATE%.log",
        datePattern: "YYYY-MM-DD",
        maxSize: cfg.maxSize,
        maxFiles: cfg.maxFiles,
        zippedArchive: true,
      })
    );

    logger.add(
      new DailyRotate({
        dirname: logDir,
        filename: "reminder-bot-error-%DATE%.log",
        datePattern: "YYYY-MM-DD",
        level: "error",
        maxSize: cfg.maxSize,
        maxFiles: cfg.maxFiles,
        zippedArchive: true,
      })
    );
  } catch {
    // winston-daily-rotate-file not installed — console only
    logger.warn("File logging disabled (winston-daily-rotate-file not installed)");
  }

  return logger;
}

// Singleton — top-level await (supported in ES modules with Node 18+)
const logger = await buildLogger();

export default logger;