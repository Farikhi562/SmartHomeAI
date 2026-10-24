import { itemUpdateSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import { consumeRate } from "@/lib/rate-limit";
import { jsonError, jsonOk, parse, readJson } from "@/server/http/handler";
import { get, remove, update } from "@/server/services/items";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/items/:id — a single item with its derived last location. */
export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/items/[id]";
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const item = await get(user.id, id);
    return jsonOk({ item, requestId }, requestId);
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}

/** PATCH /api/items/:id — field edits only; events are never touched (FR-002.3). */
export async function PATCH(req: Request, ctx: RouteContext): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/items/[id]";
  try {
    const user = await requireUser(req);
    consumeRate(user.id, "writes");
    const { id } = await ctx.params;
    const input = parse(itemUpdateSchema, await readJson(req));
    const item = await update(user.id, id, input);
    return jsonOk({ item, requestId }, requestId);
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}

/** DELETE /api/items/:id — soft delete (FR-016); a repeat reads as 404. */
export async function DELETE(req: Request, ctx: RouteContext): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/items/[id]";
  try {
    const user = await requireUser(req);
    consumeRate(user.id, "writes");
    const { id } = await ctx.params;
    const item = await remove(user.id, id);
    return jsonOk({ item, requestId }, requestId);
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}
