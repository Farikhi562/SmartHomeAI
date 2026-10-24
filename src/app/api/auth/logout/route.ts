import { cookies } from "next/headers";
import { toErrorPayload } from "@/lib/errors";
import { log } from "@/lib/observability/logger";
import { REFRESH_COOKIE, SESSION_COOKIE, expiredCookieOptions } from "@/lib/auth";

/** Clears both session cookies (works for dev and Supabase modes). */
export async function POST(): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const store = await cookies();
    store.set(SESSION_COOKIE, "", expiredCookieOptions("/"));
    store.set(REFRESH_COOKIE, "", expiredCookieOptions("/api/auth"));
    log.info({ event: "auth.logout", requestId, route: "/api/auth/logout", status: 200 });
    return Response.json({ ok: true, requestId });
  } catch (err) {
    const { status, body } = toErrorPayload(err, requestId);
    return Response.json(body, { status });
  }
}
