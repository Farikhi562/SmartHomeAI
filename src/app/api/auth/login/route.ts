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
  verifyAccessToken,
} from "@/lib/auth";
import { upsertUser } from "@/server/repositories/users";

const bodySchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(128),
});

/** Password login via Supabase Auth (GoTrue); session lands in an httpOnly cookie. */
export async function POST(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const env = getEnv();
    if (env.AUTH_MODE !== "supabase") {
      throw errors.unauthenticated("Password sign-in is disabled in this environment (dev mode).");
    }
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    consumeRate(`login:${ip}`, "writes");

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw errors.validation(parsed.error.issues.map((i) => ({ path: i.path.join("."), issue: i.message })));
    }
    const { email, password } = parsed.data;

    const tokens = await supabaseLogin(email, password);
    const user = await verifyAccessToken(tokens.accessToken);
    await upsertUser({ id: user.id, email: user.email });

    const store = await cookies();
    store.set(SESSION_COOKIE, tokens.accessToken, sessionCookieOptions(tokens.expiresIn));
    store.set(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions());

    log.info({ event: "auth.login", requestId, route: "/api/auth/login", status: 200 });
    return Response.json({ user: { id: user.id, email: user.email }, requestId });
  } catch (err) {
    const { status, body } = toErrorPayload(err, requestId);
    log.warn({ event: "auth.login.failed", requestId, route: "/api/auth/login", status, errorCode: body.error.code });
    return Response.json(body, { status });
  }
}
