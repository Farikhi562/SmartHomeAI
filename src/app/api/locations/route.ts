import { locationCreateSchema, locationListQuery } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import { consumeRate } from "@/lib/rate-limit";
import { jsonError, jsonOk, parse, queryRecord, readJson } from "@/server/http/handler";
import { create, list } from "@/server/services/locations";

/** GET /api/locations — flat list with server-computed depth + path (FR-017). */
export async function GET(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/locations";
  try {
    const user = await requireUser(req);
    const query = parse(locationListQuery, queryRecord(req));
    const locations = await list(user.id, query.includeArchived);
    return jsonOk({ locations, requestId }, requestId);
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}

/** POST /api/locations — create; enforces depth limit + sibling uniqueness (BR-04). */
export async function POST(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/locations";
  try {
    const user = await requireUser(req);
    consumeRate(user.id, "writes");
    const input = parse(locationCreateSchema, await readJson(req));
    const location = await create(user.id, input);
    return jsonOk({ location, requestId }, requestId, 201);
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}
