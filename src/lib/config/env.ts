import { z } from "zod";

/**
 * Typed, Zod-validated environment loader (T-015/T-020).
 * Never throws at import time in the browser — only `getEnv()` on the server.
 * Defaults are development-safe; production deployments must set these explicitly.
 */

/** Placeholder-aware optional string: empty or REPLACE_WITH_* template values → undefined. */
const optionalPlaceholder = z.preprocess(
  (v) => (typeof v === "string" && (v.trim() === "" || v.trim().startsWith("REPLACE_WITH")) ? undefined : v),
  z.string().optional(),
);

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  LOG_SALT: z.string().default("dev-salt-change-me"),

  DATABASE_URL: z.string().min(1).default("postgresql://smarthomeai:smarthomeai@localhost:5432/smarthomeai?schema=public"),
  DIRECT_URL: z.string().min(1).optional(),

  // Auth (D5, ADR-005): "supabase" verifies Supabase Auth access tokens using
  // the project's JWKS (with legacy HS256/SUPABASE_JWT_SECRET compatibility);
  // "dev" enables the local email-only dev login (never allowed in production).
  AUTH_MODE: z.enum(["dev", "supabase"]).default("dev"),
  AUTH_DEV_SECRET: z.string().min(16).default("dev-only-secret-change-me-0123456789"),
  SUPABASE_URL: optionalPlaceholder.refine((v) => v === undefined || /^https:\/\//.test(v), {
    message: "SUPABASE_URL must be an https URL",
  }),
  SUPABASE_ANON_KEY: optionalPlaceholder,
  SUPABASE_JWT_SECRET: optionalPlaceholder,

  GROQ_API_KEY: optionalPlaceholder,
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  GROQ_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  GROQ_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  GROQ_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(1024),

  RATE_LIMIT_ASSISTANT_PER_MIN: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_WRITES_PER_MIN: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_READS_PER_MIN: z.coerce.number().int().positive().default(120),
  ASSISTANT_DAILY_MESSAGE_CAP_PER_USER: z.coerce.number().int().positive().default(100),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Fail loudly and precisely in server context; misconfiguration is fatal.
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Development-only auth escape hatch guard (FR-001, SECURITY.md). */
export function isDevAuthAllowed(): boolean {
  const env = getEnv();
  return env.AUTH_MODE === "dev" && env.NODE_ENV !== "production";
}

/** Supabase Auth (GoTrue) issuer claim: `<SUPABASE_URL>/auth/v1` (ADR-005). */
export function supabaseIssuer(): string {
  const env = getEnv();
  if (!env.SUPABASE_URL) {
    throw new Error("SUPABASE_URL is required when AUTH_MODE=supabase");
  }
  return `${env.SUPABASE_URL}/auth/v1`;
}

/** True when the runtime is configured for hosted Supabase Auth (D5 amended). */
export function isSupabaseAuthConfigured(): boolean {
  const env = getEnv();
  return env.AUTH_MODE === "supabase" && Boolean(env.SUPABASE_URL);
}
