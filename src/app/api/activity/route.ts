import { activityQuery } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk, parse, queryRecord } from "@/server/http/handler";
import { activity } from "@/server/services/events";

/** GET /api/activity — recent recorded events across all items (FR-018). */
export async function GET(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/activity";
  try {
    const user = await requireUser(req);
    const query = parse(activityQuery, queryRecord(req));
    const result = await activity(user.id, query.sinceDays, query);
    return jsonOk(
      {
        entries: result.entries,
        pagination: { limit: query.limit, offset: query.offset, total: result.total },
        requestId,
      },
      requestId,
    );
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}
