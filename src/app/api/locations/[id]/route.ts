import { locationUpdateSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import { consumeRate } from "@/lib/rate-limit";
import { jsonError, jsonOk, parse, readJson } from "@/server/http/handler";
import { remove, update } from "@/server/services/locations";

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/locations/:id — rename / re-parent; cycle + depth guards (BR-04). */
export async function PATCH(req: Request, ctx: RouteContext): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/locations/[id]";
  try {
    const user = await requireUser(req);
    consumeRate(user.id, "writes");
    const { id } = await ctx.params;
    const input = parse(locationUpdateSchema, await readJson(req));
    const location = await update(user.id, id, input);
    return jsonOk({ location, requestId }, requestId);
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}

/** DELETE /api/locations/:id — hard delete, only when childless + unreferenced (FR-017). */
export async function DELETE(req: Request, ctx: RouteContext): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/locations/[id]";
  try {
    const user = await requireUser(req);
    consumeRate(user.id, "writes");
    const { id } = await ctx.params;
    const result = await remove(user.id, id);
    return jsonOk({ ...result, requestId }, requestId);
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}
