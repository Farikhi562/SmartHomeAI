import { searchQuery } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk, parse, queryRecord } from "@/server/http/handler";
import { search } from "@/server/services/search";

/** GET /api/search — ranked cross-entity search (FR-005). */
export async function GET(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/search";
  try {
    const user = await requireUser(req);
    const query = parse(searchQuery, queryRecord(req));
    const result = await search(user.id, query);
    return jsonOk(
      { items: result.items, locations: result.locations, pagination: result.pagination, requestId },
      requestId,
    );
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}
