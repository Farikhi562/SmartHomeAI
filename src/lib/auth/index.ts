import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { errors } from "@/lib/errors";
import { getEnv, isDevAuthAllowed, supabaseIssuer } from "@/lib/config/env";

/**
 * Authentication module (FR-001, FR-012 — D5 amended 2026-10-17, ADR-005).
 *
 * Modes:
 *  - "supabase": verifies Supabase Auth (GoTrue) access tokens — HS256 with
 *    SUPABASE_JWT_SECRET, issuer `<SUPABASE_URL>/auth/v1`, audience
 *    `authenticated`. The production path; login/signup/refresh are proxied by
 *    our API routes so the session cookie stays httpOnly.
 *  - "dev": local-only HS256 session JWTs minted by POST /api/auth/dev-login.
 *    Explicitly refused when NODE_ENV=production (isDevAuthAllowed).
 *
 * `requireUser()` is the single enforcement point for every protected operation.
 * The ownerId is ALWAYS derived from the verified token `sub` — never from payloads.
 */

export type AuthUser = { id: string; email: string };

export const SESSION_COOKIE = "shai_session"; // access token; path=/
export const REFRESH_COOKIE = "shai_refresh"; // refresh token; path=/api/auth
const DEV_SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7 days for dev sessions
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // Supabase refresh token window

// ── Token verification ───────────────────────────────────────────────────────

/** Verify an access token according to AUTH_MODE. Returns the verified subject + email. */
export async function verifyAccessToken(token: string): Promise<AuthUser> {
  const env = getEnv();
  if (env.AUTH_MODE === "supabase") {
    if (!env.SUPABASE_JWT_SECRET) throw errors.unauthenticated("Supabase Auth is not configured.");
    const { payload } = await jwtVerify(token, new TextEncoder().encode(env.SUPABASE_JWT_SECRET), {
      issuer: supabaseIssuer(),
      audience: "authenticated",
    });
    const sub = payload.sub;
    const email = typeof payload.email === "string" ? payload.email : undefined;
    if (!sub || !email) throw errors.unauthenticated();
    return { id: sub, email };
  }
  // dev mode: our own HS256 session token
  const { payload } = await jwtVerify(token, new TextEncoder().encode(env.AUTH_DEV_SECRET), {
    issuer: "smarthomeai-dev",
  });
  const sub = payload.sub;
  const email = typeof payload.email === "string" ? payload.email : undefined;
  if (!sub || !email) throw errors.unauthenticated();
  return { id: sub, email };
}

/** Mint a dev session token (dev-login only). */
export async function mintDevSession(user: AuthUser): Promise<string> {
  if (!isDevAuthAllowed()) throw errors.unauthenticated("Dev login is disabled.");
  const env = getEnv();
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer("smarthomeai-dev")
    .setIssuedAt()
    .setExpirationTime(`${DEV_SESSION_TTL_SEC}s`)
    .sign(new TextEncoder().encode(env.AUTH_DEV_SECRET));
}

/** Resolve the authenticated user from Bearer header or session cookie; blocks soft-deleted accounts. */
export async function requireUser(req?: Request): Promise<AuthUser> {
  const header = req?.headers.get("authorization");
  let token: string | undefined;
  if (header?.startsWith("Bearer ")) token = header.slice(7);
  if (!token) {
    const store = await cookies();
    token = store.get(SESSION_COOKIE)?.value;
  }
  if (!token) throw errors.unauthenticated();
  let user: AuthUser;
  try {
    user = await verifyAccessToken(token);
  } catch {
    throw errors.unauthenticated("Your session is invalid or expired. Sign in again.");
  }
  // Soft-deleted accounts are blocked at the auth boundary (FR-014).
  const row = await prisma.user.findUnique({ where: { id: user.id } });
  if (row?.deletedAt) throw errors.unauthenticated("This account has been deleted.");
  return user;
}

// ── Cookie helpers ───────────────────────────────────────────────────────────

export function sessionCookieOptions(maxAge?: number) {
  const env = getEnv();
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAge ?? DEV_SESSION_TTL_SEC,
  };
}

/** Refresh cookie is scoped to /api/auth so only auth routes can read it. */
export function refreshCookieOptions() {
  return { ...sessionCookieOptions(REFRESH_COOKIE_MAX_AGE), path: "/api/auth" };
}

export function expiredCookieOptions(path = "/") {
  return { ...sessionCookieOptions(0), path };
}

// ── Supabase Auth (GoTrue) proxy ─────────────────────────────────────────────

export type SessionTokens = { accessToken: string; refreshToken: string; expiresIn: number };

const GOTRUE_TIMEOUT_MS = 10_000;

async function gotrue(path: string, body: unknown): Promise<Response> {
  const env = getEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw errors.internal();
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GOTRUE_TIMEOUT_MS);
  try {
    return await fetch(`${env.SUPABASE_URL}/auth/v1${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: env.SUPABASE_ANON_KEY },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    throw errors.unauthenticated("Sign-in is temporarily unavailable. Try again shortly.");
  } finally {
    clearTimeout(timer);
  }
}

function errorDescription(data: unknown): string {
  if (data && typeof data === "object") {
    const d = data as { error_description?: string; msg?: string; error?: string };
    return d.error_description ?? d.msg ?? d.error ?? "";
  }
  return "";
}

/** Password grant → session tokens. Generic errors: never disclose account existence. */
export async function supabaseLogin(email: string, password: string): Promise<SessionTokens> {
  const res = await gotrue("/token?grant_type=password", { email, password });
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => null);
    const desc = errorDescription(data);
    if (res.status === 400 || res.status === 401) {
      throw errors.unauthenticated("Invalid email or password.");
    }
    if (res.status === 429) throw errors.rateLimited(60);
    if (desc.includes("Email not confirmed")) {
      throw errors.unauthenticated("Confirm your email address before signing in.");
    }
    throw errors.unauthenticated("Sign-in failed. Try again shortly.");
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
}

/**
 * Sign-up. GoTrue answers 200/201 (confirmation flow) or 400 with
 * "User already registered" — we answer identically either way to avoid
 * account enumeration (AC-001-4), unless Supabase returns a session directly.
 */
export async function supabaseSignup(
  email: string,
  password: string,
): Promise<{ hasSession: boolean }> {
  const res = await gotrue("/signup", { email, password });
  if (res.ok) {
    const data: unknown = await res.json().catch(() => null);
    const hasSession = Boolean(
      data && typeof data === "object" && "access_token" in data && data.access_token,
    );
    return { hasSession };
  }
  const data: unknown = await res.json().catch(() => null);
  const desc = errorDescription(data);
  if (desc.includes("already registered")) {
    // Same response shape as success: no enumeration. The user signs in instead.
    return { hasSession: false };
  }
  if (res.status === 429) throw errors.rateLimited(60);
  if (res.status >= 400 && res.status < 500) {
    throw errors.validation(
      [{ path: "password", issue: desc || "Password does not meet policy." }],
      "Could not create the account.",
    );
  }
  throw errors.unauthenticated("Sign-up is temporarily unavailable. Try again shortly.");
}

/** Refresh-token grant → new session tokens (rotation). */
export async function supabaseRefresh(refreshToken: string): Promise<SessionTokens> {
  const res = await gotrue("/token?grant_type=refresh_token", { refresh_token: refreshToken });
  if (!res.ok) throw errors.unauthenticated("Your session has expired. Sign in again.");
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
}
