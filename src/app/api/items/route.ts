import { itemCreateSchema, itemListQuery } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import { consumeRate } from "@/lib/rate-limit";
import { jsonError, jsonOk, parse, queryRecord, readJson } from "@/server/http/handler";
import { create, list } from "@/server/services/items";

/** GET /api/items — filtered, paginated inventory (FR-002.1). */
export async function GET(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/items";
  try {
    const user = await requireUser(req);
    const query = parse(itemListQuery, queryRecord(req));
    const result = await list(user.id, query);
    return jsonOk(
      {
        items: result.items,
        pagination: { limit: query.limit, offset: query.offset, total: result.total },
        requestId,
      },
      requestId,
    );
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}

/** POST /api/items — create; optional locationId appends the first event atomically. */
export async function POST(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/items";
  try {
    const user = await requireUser(req);
    consumeRate(user.id, "writes");
    const input = parse(itemCreateSchema, await readJson(req));
    const result = await create(user.id, input);
    return jsonOk({ item: result, requestId }, requestId, 201);
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}
