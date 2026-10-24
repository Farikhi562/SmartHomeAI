import { NextResponse } from "next/server";
import type { z } from "zod";
import { ApiError, errors, toErrorPayload } from "@/lib/errors";
import { log } from "@/lib/observability/logger";

/**
 * Thin route-handler toolkit (API_SPEC §1/§2): request ids, shared zod parsing,
 * and error-envelope responses. Handlers keep their own try/catch so the
 * requestId → log → envelope mapping stays visible at every call site.
 */

const MAX_BODY_BYTES = 32 * 1024; // API_SPEC §2 (413 above 32 KB)

/** Per-request correlation id (echoed in headers, logs and error bodies). */
export function newRequestId(): string {
  return crypto.randomUUID();
}

/** Map zod issues to the wire `details` shape ({ path, issue }). */
export function zodDetails(error: z.ZodError): { path: string; issue: string }[] {
  return error.issues.map((issue) => ({ path: issue.path.join("."), issue: issue.message }));
}

/** Parse with a shared schema; throws 400 VALIDATION_ERROR carrying field paths. */
export function parse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw errors.validation(zodDetails(result.error));
  return result.data;
}

/** Flatten the query string into a plain record for zod query schemas. */
export function queryRecord(req: Request): Record<string, string> {
  return Object.fromEntries(new URL(req.url).searchParams.entries());
}

/** Read a JSON body with size + syntax guards (413 / 400 instead of 500). */
export async function readJson(req: Request): Promise<unknown> {
  const length = req.headers.get("content-length");
  if (length !== null && Number(length) > MAX_BODY_BYTES) {
    throw new ApiError("PAYLOAD_TOO_LARGE", "Request body exceeds 32 KB.");
  }
  try {
    const body: unknown = await req.json();
    return body === null || body === undefined ? {} : body;
  } catch {
    throw errors.validation([{ path: "", issue: "Body must be a JSON object." }]);
  }
}

/** Success response with the request-id header. */
export function jsonOk(body: unknown, requestId: string, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "x-request-id": requestId } });
}

/**
 * Log (operational metadata only — never content, BR-09) and map any thrown
 * value to the wire error envelope (API_SPEC §2).
 */
export function jsonError(err: unknown, requestId: string, route: string): NextResponse {
  const payload = toErrorPayload(err, requestId);
  log.error({ requestId, route, errorCode: payload.body.error.code });
  const headers = new Headers({ "x-request-id": requestId });
  const retryAfter = payload.body.error.retryAfter;
  if (payload.body.error.code === "RATE_LIMITED" && typeof retryAfter === "number") {
    headers.set("Retry-After", String(retryAfter));
  }
  return NextResponse.json(payload.body, { status: payload.status, headers });
}
