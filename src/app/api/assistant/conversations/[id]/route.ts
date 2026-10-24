import { paginationQuery } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import { consumeRate } from "@/lib/rate-limit";
import { jsonError, jsonOk, parse, queryRecord } from "@/server/http/handler";
import { getConversationMessages, removeConversation } from "@/server/services/assistant";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/assistant/conversations/:id — messages in chat order (FR-023). */
export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/assistant/conversations/[id]";
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const page = parse(paginationQuery, queryRecord(req));
    const result = await getConversationMessages(user.id, id, page);
    return jsonOk(
      {
        messages: result.messages,
        pagination: { limit: page.limit, offset: page.offset, total: result.total },
        requestId,
      },
      requestId,
    );
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}

/** DELETE /api/assistant/conversations/:id — hard delete incl. messages (BR-09). */
export async function DELETE(req: Request, ctx: RouteContext): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/assistant/conversations/[id]";
  try {
    const user = await requireUser(req);
    consumeRate(user.id, "writes");
    const { id } = await ctx.params;
    const result = await removeConversation(user.id, id);
    return jsonOk({ ...result, requestId }, requestId);
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}
