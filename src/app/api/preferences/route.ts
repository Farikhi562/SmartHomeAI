import { preferencesUpdateSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk, parse, readJson } from "@/server/http/handler";
import { getPreferences, upsertPreferences } from "@/server/repositories/users";

type PreferencesDto = {
  theme: string;
  locale: string | null;
  showSuggestedQuestions: boolean;
};

function toPreferencesDto(row: {
  theme: string;
  locale: string | null;
  showSuggestedQuestions: boolean;
}): PreferencesDto {
  return {
    theme: row.theme,
    locale: row.locale,
    showSuggestedQuestions: row.showSuggestedQuestions,
  };
}

/** GET /api/preferences — reads (and idempotently creates) the owner's row. */
export async function GET(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/preferences";
  try {
    const user = await requireUser(req);
    const row = await getPreferences(user.id);
    return jsonOk({ preferences: toPreferencesDto(row), requestId }, requestId);
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}

/** PATCH /api/preferences — partial update (FR-021). */
export async function PATCH(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/preferences";
  try {
    const user = await requireUser(req);
    const input = parse(preferencesUpdateSchema, await readJson(req));
    const row = await upsertPreferences(user.id, input);
    return jsonOk({ preferences: toPreferencesDto(row), requestId }, requestId);
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}
