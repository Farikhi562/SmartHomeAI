import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { errors } from "@/lib/errors";
import {
  REFRESH_COOKIE,
  SESSION_COOKIE,
  refreshCookieOptions,
  sessionCookieOptions,
  supabasePkceExchange,
  verifyAccessToken,
} from "@/lib/auth";
import { getEnv } from "@/lib/config/env";
import { upsertUser } from "@/server/repositories/users";

const VERIFIER_COOKIE = "shai_google_verifier";
const STATE_COOKIE = "shai_google_state";
const NEXT_COOKIE = "shai_google_next";

function safeNext(value: string | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

function clearOAuthCookies(response: NextResponse): void {
  for (const name of [VERIFIER_COOKIE, STATE_COOKIE, NEXT_COOKIE]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: getEnv().NODE_ENV === "production",
      path: "/api/auth/google",
      maxAge: 0,
    });
  }
}

function loginRedirect(req: Request, next: string, error?: string): NextResponse {
  const url = new URL("/login", req.url);
  url.searchParams.set("next", safeNext(next));
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

/** Completes Google OAuth, exchanges the PKCE code, and creates app cookies. */
export async function GET(req: Request): Promise<Response> {
  const env = getEnv();
  const requestUrl = new URL(req.url);
  const store = await cookies();
  const next = safeNext(store.get(NEXT_COOKIE)?.value);
  const oauthError = requestUrl.searchParams.get("error");
  if (oauthError) return loginRedirect(req, next, "google_cancelled");

  const code = requestUrl.searchParams.get("code");
  const returnedState = requestUrl.searchParams.get("state");
  const expectedState = store.get(STATE_COOKIE)?.value;
  const verifier = store.get(VERIFIER_COOKIE)?.value;
  if (!code || !returnedState || !expectedState || !verifier) {
    return loginRedirect(req, next, "google_session_expired");
  }

  const expected = Buffer.from(expectedState);
  const actual = Buffer.from(returnedState);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return loginRedirect(req, next, "google_invalid_state");
  }

  try {
    if (env.AUTH_MODE !== "supabase") throw errors.unauthenticated();
    const tokens = await supabasePkceExchange(code, verifier);
    const user = await verifyAccessToken(tokens.accessToken);
    await upsertUser({ id: user.id, email: user.email });

    const response = loginRedirect(req, next);
    response.cookies.set(SESSION_COOKIE, tokens.accessToken, sessionCookieOptions(tokens.expiresIn));
    response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions());
    clearOAuthCookies(response);
    return response;
  } catch {
    return loginRedirect(req, next, "google_failed");
  }
}
