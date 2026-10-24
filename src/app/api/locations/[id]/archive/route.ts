import { requireUser } from "@/lib/auth";
import { consumeRate } from "@/lib/rate-limit";
import { jsonError, jsonOk } from "@/server/http/handler";
import { archive } from "@/server/services/locations";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/locations/:id/archive — blocked (409) while still referenced (BR-05). */
export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/locations/[id]/archive";
  try {
    const user = await requireUser(req);
    consumeRate(user.id, "writes");
    const { id } = await ctx.params;
    const location = await archive(user.id, id);
    return jsonOk({ location, requestId }, requestId);
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}
