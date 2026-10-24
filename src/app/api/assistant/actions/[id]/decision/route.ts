import { actionDecisionSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import { consumeRate } from "@/lib/rate-limit";
import { jsonError, jsonOk, parse, readJson } from "@/server/http/handler";
import { decideAction } from "@/server/services/assistant";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/assistant/actions/:id/decision — confirm/cancel a pending write
 * (FR-024). `:id` is the assistant MESSAGE id carrying the pendingAction.
 * The write runs only here, through the same validated services as UI writes.
 */
export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/assistant/actions/[id]/decision";
  try {
    const user = await requireUser(req);
    consumeRate(user.id, "writes");
    const { id } = await ctx.params;
    const input = parse(actionDecisionSchema, await readJson(req));
    const result = await decideAction(user.id, id, input);
    return jsonOk({ ...result, requestId }, requestId);
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}
