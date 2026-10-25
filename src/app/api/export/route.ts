import { requireUser } from "@/lib/auth";
import { jsonError } from "@/server/http/handler";
import { collect } from "@/server/services/export";

/**
 * GET /api/export — FR-022 / API_SPEC §3.7: the ONE documented exception to the
 * `{ data, requestId }` envelope. The 200 body IS the payload object
 * `{ items, locations, events, preferences, exportedAt }`, served with
 * `Content-Disposition: attachment` so the browser saves a file. Every non-2xx
 * response still uses the standard error envelope (jsonError).
 *
 * `ownerId` comes only from the verified session token (FR-012); middleware
 * already rejects cookie-less calls, `requireUser()` verifies the signature.
 */

/** `YYYY-MM-DD` of the server clock — the `<date>` in the download filename. */
function serverDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/export";
  try {
    const user = await requireUser(req);
    const payload = await collect(user.id);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="smarthomeai-ekspor-${serverDate()}.json"`,
        "x-request-id": requestId,
      },
    });
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}
