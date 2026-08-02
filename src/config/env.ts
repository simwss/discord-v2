import "dotenv/config";
import { z } from "zod";

/**
 * The v1 bot read bare env names like `API_KEY`. Those are ambiguous in a
 * shared environment, so v2 prefers `FIREBASE_`-prefixed names but still
 * accepts the legacy ones so an existing `.env` keeps working.
 */
function withLegacy(name: string, legacy: string): string | undefined {
  return process.env[name] ?? process.env[legacy];
}

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

  firebase: z.object({
    apiKey: z.string().min(1, "FIREBASE_API_KEY is required"),
    databaseURL: z.url("FIREBASE_DATABASE_URL must be a URL"),
    projectId: z.string().min(1, "FIREBASE_PROJECT_ID is required"),
    authDomain: z.string().optional(),
    storageBucket: z.string().optional(),
    messagingSenderId: z.string().optional(),
    appId: z.string().optional(),
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
    firebase: {
      apiKey: withLegacy("FIREBASE_API_KEY", "API_KEY"),
      databaseURL: withLegacy("FIREBASE_DATABASE_URL", "DATABASE_URL"),
      projectId: withLegacy("FIREBASE_PROJECT_ID", "PROJECT_ID"),
      authDomain: withLegacy("FIREBASE_AUTH_DOMAIN", "AUTH_DOMAIN"),
      storageBucket: withLegacy("FIREBASE_STORAGE_BUCKET", "STORAGE_BUCKET"),
      messagingSenderId: withLegacy(
        "FIREBASE_MESSAGING_SENDER_ID",
        "MESSAGING_SENDER_ID",
      ),
      appId: process.env.FIREBASE_APP_ID,
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
