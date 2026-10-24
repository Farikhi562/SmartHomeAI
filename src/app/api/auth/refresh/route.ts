import { cookies } from "next/headers";
import { toErrorPayload } from "@/lib/errors";
import { REFRESH_COOKIE, SESSION_COOKIE, expiredCookieOptions, refreshCookieOptions, supabaseRefresh } from "@/lib/auth";

/**
 * Rotates the session (Supabase refresh-token grant). The client calls this once
 * after a 401 before giving up; a missing/invalid refresh token → 401.
 */
export async function POST(): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const store = await cookies();
    const refreshToken = store.get(REFRESH_COOKIE)?.value;
    if (!refreshToken) {
      return Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Your session has expired. Sign in again.", requestId } },
        { status: 401 },
      );
    }
    const tokens = await supabaseRefresh(refreshToken);
    store.set(SESSION_COOKIE, tokens.accessToken, { ...expiredCookieOptions(), ...{ maxAge: tokens.expiresIn } });
    store.set(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions());
    return Response.json({ ok: true, requestId });
  } catch (err) {
    const { status, body } = toErrorPayload(err, requestId);
    if (status === 401) {
      const store = await cookies();
      store.delete(SESSION_COOKIE);
      store.delete(REFRESH_COOKIE);
    }
    return Response.json(body, { status });
  }
}
