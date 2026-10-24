import { jsonOk } from "@/server/http/handler";

/**
 * Liveness probe (API_SPEC §1). No auth, no DB — it answers whether the
 * process is up, so a database outage stays visible on deeper routes instead
 * of masking the whole service as unhealthy.
 */
export async function GET(): Promise<Response> {
  const requestId = crypto.randomUUID();
  return jsonOk({ status: "ok", time: new Date().toISOString() }, requestId);
}
