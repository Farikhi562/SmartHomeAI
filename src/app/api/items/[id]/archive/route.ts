import { requireUser } from "@/lib/auth";
import { consumeRate } from "@/lib/rate-limit";
import { jsonError, jsonOk } from "@/server/http/handler";
import { archive } from "@/server/services/items";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/items/:id/archive — idempotent archive. */
export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/items/[id]/archive";
  try {
    const user = await requireUser(req);
    consumeRate(user.id, "writes");
    const { id } = await ctx.params;
    const item = await archive(user.id, id);
    return jsonOk({ item, requestId }, requestId);
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}
