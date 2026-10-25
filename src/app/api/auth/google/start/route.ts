import { randomBytes, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/config/env";

const VERIFIER_COOKIE = "shai_google_verifier";
const NEXT_COOKIE = "shai_google_next";
const OAUTH_COOKIE_MAX_AGE = 10 * 60;

function cookieOptions() {
  const env = getEnv();
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: OAUTH_COOKIE_MAX_AGE,
  };
}

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

/** Starts Google OAuth through Supabase Auth using PKCE. */
export async function GET(req: Request): Promise<Response> {
  const env = getEnv();
  if (env.AUTH_MODE !== "supabase" || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return NextResponse.redirect(new URL("/login?error=google_not_configured", req.url));
  }

  const requestUrl = new URL(req.url);
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const redirectTo = new URL("/api/auth/google/callback", env.APP_URL).toString();

  const authorizeUrl = new URL(`${env.SUPABASE_URL}/auth/v1/authorize`);
  authorizeUrl.searchParams.set("provider", "google");
  authorizeUrl.searchParams.set("redirect_to", redirectTo);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(authorizeUrl);
  const options = cookieOptions();
  response.cookies.set(VERIFIER_COOKIE, verifier, options);
  response.cookies.set(NEXT_COOKIE, safeNext(requestUrl.searchParams.get("next")), options);
  return response;
}
