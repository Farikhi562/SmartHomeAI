import { eventCreateSchema, paginationQuery } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import { consumeRate } from "@/lib/rate-limit";
import { jsonError, jsonOk, parse, queryRecord, readJson } from "@/server/http/handler";
import { recordLocation, timeline } from "@/server/services/events";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/items/:id/events — append-only timeline, newest first (FR-004.3). */
export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/items/[id]/events";
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const page = parse(paginationQuery, queryRecord(req));
    const result = await timeline(user.id, id, page);
    return jsonOk(
      {
        events: result.events,
        pagination: { limit: page.limit, offset: page.offset, total: result.total },
        requestId,
      },
      requestId,
    );
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}

/** POST /api/items/:id/events — append a location memory (FR-003, append-only). */
export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/items/[id]/events";
  try {
    const user = await requireUser(req);
    consumeRate(user.id, "writes");
    const { id } = await ctx.params;
    const input = parse(eventCreateSchema, await readJson(req));
    const event = await recordLocation(user.id, id, input);
    return jsonOk({ event, requestId }, requestId, 201);
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}
