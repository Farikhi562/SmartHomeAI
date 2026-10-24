import { devLoginSchema } from "@/lib/validation";
import { jsonError, jsonOk, parse, readJson } from "@/server/http/handler";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { devLogin } from "@/server/services/auth-dev";
import { cookies } from "next/headers";

/**
 * POST /api/auth/dev-login — local-only email login (never in production).
 * Sets the httpOnly session cookie and returns the same user shape as login.
 */
export async function POST(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/auth/dev-login";
  try {
    const input = parse(devLoginSchema, await readJson(req));
    const { token, user } = await devLogin(input.email);
    const store = await cookies();
    store.set(SESSION_COOKIE, token, sessionCookieOptions());
    return jsonOk({ user, requestId }, requestId);
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}
