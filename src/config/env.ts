import "dotenv/config";
import { z } from "zod";

/**
 * The v1 bot read a bare `APP_ID`. That is ambiguous in a shared environment,
 * so v2 prefers the `DISCORD_`-prefixed name but still accepts the legacy one
 * so an existing `.env` keeps working.
 */
function withLegacy(name: string, legacy: string): string | undefined {
  return process.env[name] ?? process.env[legacy];
}

/**
 * Catches the most likely misconfiguration by far: leaving the Firebase
 * `DATABASE_URL` from v2.0 in place after the move to Postgres. An `https://`
 * URL fails here with a readable message instead of somewhere inside `pg`.
 */
const POSTGRES_URL = /^postgres(ql)?:\/\//;

const csvUserIds = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  )
  .pipe(z.array(z.string().regex(/^\d{17,20}$/, "not a Discord snowflake")));

const envSchema = z.object({
  nodeEnv: z.enum(["development", "test", "production"]).default("development"),
  logLevel: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
  healthPort: z.coerce.number().int().min(0).max(65535).default(3001),

  discord: z.object({
    token: z.string().min(1, "DISCORD_TOKEN is required"),
    applicationId: z.string().min(1, "DISCORD_APP_ID is required"),
    guildId: z.string().optional(),
  }),

  database: z.object({
    url: z
      .string("DATABASE_URL is required")
      .regex(
        POSTGRES_URL,
        "DATABASE_URL must be a postgres:// connection string",
      ),
    // One connection per concurrently-running command. A Discord bot handles
    // interactions one gateway event at a time, so a handful is plenty.
    poolMax: z.coerce.number().int().min(1).max(100).default(10),
    // `on` verifies the server certificate; `no-verify` encrypts without
    // verifying, which is what most managed providers need without a CA file.
    ssl: z.enum(["off", "on", "no-verify"]).default("off"),
  }),

  bannedUserIds: csvUserIds,
});

export type Env = z.infer<typeof envSchema>;

function readEnv(): Env {
  // An empty DISCORD_GUILD_ID in a .env file means "register globally", not
  // "register to the guild named empty string".
  const guildId = process.env.DISCORD_GUILD_ID?.trim();

  const result = envSchema.safeParse({
    nodeEnv: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL,
    healthPort: process.env.HEALTH_PORT,
    discord: {
      token: process.env.DISCORD_TOKEN,
      applicationId: withLegacy("DISCORD_APP_ID", "APP_ID"),
      guildId: guildId === "" ? undefined : guildId,
    },
    database: {
      url: process.env.DATABASE_URL,
      poolMax: process.env.DATABASE_POOL_MAX,
      ssl: process.env.DATABASE_SSL,
    },
    bannedUserIds: process.env.BANNED_USER_IDS,
  });

  if (!result.success) {
    const issues = result.error.issues
      .map(
        (issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`,
      )
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\nSee .env.example for the full list of variables.`,
    );
  }

  return result.data;
}

let cached: Env | undefined;

/** Parses and caches the process environment. Throws on invalid config. */
export function getEnv(): Env {
  cached ??= readEnv();
  return cached;
}
