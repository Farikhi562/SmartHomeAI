import { requireUser } from "@/lib/auth";
import { consumeRate } from "@/lib/rate-limit";
import { jsonError, jsonOk } from "@/server/http/handler";
import { restore } from "@/server/services/items";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/items/:id/restore — 30-day window, else 409 (BR-07). */
export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/items/[id]/restore";
  try {
    const user = await requireUser(req);
    consumeRate(user.id, "writes");
    const { id } = await ctx.params;
    const item = await restore(user.id, id);
    return jsonOk({ item, requestId }, requestId);
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}
