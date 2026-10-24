import { paginationQuery } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk, parse, queryRecord } from "@/server/http/handler";
import { listConversations } from "@/server/services/assistant";

/** GET /api/assistant/conversations — paginated, newest activity first (FR-023). */
export async function GET(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/assistant/conversations";
  try {
    const user = await requireUser(req);
    const page = parse(paginationQuery, queryRecord(req));
    const result = await listConversations(user.id, page);
    return jsonOk(
      {
        conversations: result.conversations,
        pagination: { limit: page.limit, offset: page.offset, total: result.total },
        requestId,
      },
      requestId,
    );
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}
