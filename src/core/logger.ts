import pino, { type Logger } from "pino";
import { getEnv } from "../config/env.js";

let cached: Logger | undefined;

/**
 * Structured JSON logging in production so a log shipper can parse it,
 * human-readable output in development.
 */
export function getLogger(): Logger {
  if (cached) return cached;

  const env = getEnv();
  const isProduction = env.nodeEnv === "production";

  cached = pino({
    level: env.logLevel,
    // Tokens and Firebase keys must never reach the log sink.
    redact: {
      paths: [
        "token",
        "*.token",
        "apiKey",
        "*.apiKey",
        "DISCORD_TOKEN",
        "req.headers.authorization",
      ],
      censor: "[redacted]",
    },
    ...(isProduction
      ? {}
      : {
          transport: {
            target: "pino-pretty",
            options: { colorize: true, translateTime: "HH:MM:ss.l" },
          },
        }),
  });

  return cached;
}
