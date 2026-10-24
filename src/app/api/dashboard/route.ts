import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/server/http/handler";
import { summary } from "@/server/services/dashboard";

/**
 * GET /api/dashboard — FR-015 aggregation. Only stored-data counts, never
 * invented metrics; works fully without the LLM (FR-013.1).
 */
export async function GET(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/dashboard";
  try {
    const user = await requireUser(req);
    const data = await summary(user.id);
    return jsonOk({ ...data, requestId }, requestId);
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}
