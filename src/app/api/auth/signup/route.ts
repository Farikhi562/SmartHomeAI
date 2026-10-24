import { z } from "zod";
import { cookies } from "next/headers";
import { errors, toErrorPayload } from "@/lib/errors";
import { getEnv } from "@/lib/config/env";
import { log } from "@/lib/observability/logger";
import { consumeRate } from "@/lib/rate-limit";
import {
  REFRESH_COOKIE,
  SESSION_COOKIE,
  refreshCookieOptions,
  sessionCookieOptions,
  supabaseLogin,
  supabaseSignup,
  verifyAccessToken,
} from "@/lib/auth";
import { upsertUser } from "@/server/repositories/users";

const bodySchema = z.object({
  email: z.string().trim().email().max(320),
  // Supabase Auth default policy: min 6 chars; we require 8 (SECURITY.md posture).
  password: z.string().min(8).max(128),
});

/**
 * Account creation via Supabase Auth. Response is deliberately uniform
 * (`confirmation_required` whether or not the email already exists) — AC-001-4,
 * no account enumeration.
 */
export async function POST(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const env = getEnv();
    if (env.AUTH_MODE !== "supabase") {
      throw errors.unauthenticated("Sign-up is disabled in this environment (dev mode).");
    }
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    consumeRate(`signup:${ip}`, "writes");

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw errors.validation(parsed.error.issues.map((i) => ({ path: i.path.join("."), issue: i.message })));
    }
    const { email, password } = parsed.data;

    const { hasSession } = await supabaseSignup(email, password);

    if (hasSession) {
      // Auto-confirm enabled in this environment: GoTrue returned a session.
      // Re-issue through the standard login path for cookie parity.
      const tokens = await supabaseLogin(email, password);
      const user = await verifyAccessToken(tokens.accessToken);
      await upsertUser({ id: user.id, email: user.email });
      const store = await cookies();
      store.set(SESSION_COOKIE, tokens.accessToken, sessionCookieOptions(tokens.expiresIn));
      store.set(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions());
      log.info({ event: "auth.signup", requestId, route: "/api/auth/signup", status: 200 });
      return Response.json({ status: "signed_in", user: { id: user.id, email: user.email }, requestId });
    }

    log.info({ event: "auth.signup.pending", requestId, route: "/api/auth/signup", status: 200 });
    return Response.json({ status: "confirmation_required", requestId });
  } catch (err) {
    const { status, body } = toErrorPayload(err, requestId);
    log.warn({ event: "auth.signup.failed", requestId, route: "/api/auth/signup", status, errorCode: body.error.code });
    return Response.json(body, { status });
  }
}
