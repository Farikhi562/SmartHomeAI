import { getEnv } from "@/lib/config/env";
import { toErrorPayload } from "@/lib/errors";

/**
 * Public auth configuration so the login page can render the right form
 * (dev mode: email-only; supabase: email + password). No secrets exposed.
 */
export async function GET(): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const env = getEnv();
    return Response.json({
      mode: env.AUTH_MODE,
      signupEnabled: env.AUTH_MODE === "supabase",
      requestId,
    });
  } catch (err) {
    const { status, body } = toErrorPayload(err, requestId);
    return Response.json(body, { status });
  }
}
