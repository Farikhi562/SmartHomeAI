import { assistantMessageSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import { consumeRate } from "@/lib/rate-limit";
import { getEnv } from "@/lib/config/env";
import { jsonError, jsonOk, parse, readJson } from "@/server/http/handler";
import { createMessage } from "@/server/services/assistant";

/**
 * POST /api/assistant/messages — one chat turn (FR-006). Rate limited per BR-12
 * (per-minute bucket + daily cap). Provider failures surface as the FR-013
 * 503 envelope with deterministic fallback results.
 */
export async function POST(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/assistant/messages";
  try {
    const user = await requireUser(req);
    const env = getEnv();
    consumeRate(user.id, "assistant", env.ASSISTANT_DAILY_MESSAGE_CAP_PER_USER);
    const input = parse(assistantMessageSchema, await readJson(req));
    const result = await createMessage(user.id, input);
    return jsonOk({ ...result, requestId }, requestId, 201);
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}
