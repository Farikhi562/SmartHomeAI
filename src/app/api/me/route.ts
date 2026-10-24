import { prisma } from "@/lib/db";
import { profileUpdateSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk, parse, readJson } from "@/server/http/handler";
import { updateUserProfile } from "@/server/repositories/users";

/** GET /api/me — the verified session owner's profile (FR-001, FR-012). */
export async function GET(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/me";
  try {
    const user = await requireUser(req);
    const row = await prisma.user.findUnique({ where: { id: user.id } });
    if (!row) {
      return jsonOk(
        { user: { id: user.id, email: user.email, displayName: null } , requestId },
        requestId,
      );
    }
    return jsonOk(
      {
        user: {
          id: row.id,
          email: row.email,
          displayName: row.displayName,
          createdAt: row.createdAt.toISOString(),
        },
        requestId,
      },
      requestId,
    );
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}

/** PATCH /api/me — display-name update. */
export async function PATCH(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const route = "/api/me";
  try {
    const user = await requireUser(req);
    const input = parse(profileUpdateSchema, await readJson(req));
    const row = await updateUserProfile(user.id, input);
    if (!row) {
      return jsonOk(
        { user: { id: user.id, email: user.email, displayName: input.displayName ?? null }, requestId },
        requestId,
      );
    }
    return jsonOk(
      {
        user: {
          id: row.id,
          email: row.email,
          displayName: row.displayName,
          createdAt: row.createdAt.toISOString(),
        },
        requestId,
      },
      requestId,
    );
  } catch (err) {
    return jsonError(err, requestId, route);
  }
}
