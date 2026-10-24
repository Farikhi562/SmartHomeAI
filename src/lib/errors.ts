/**
 * Central error hierarchy + HTTP error-envelope mapping (API_SPEC §2).
 * No stack traces or provider error text ever reach clients (FR-013, SECURITY).
 */

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "AI_UNAVAILABLE"
  | "INTERNAL";

const STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  AI_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: { path: string; issue: string }[];
  readonly extra?: Record<string, unknown>;

  constructor(
    code: ApiErrorCode,
    message: string,
    opts?: { details?: ApiError["details"]; extra?: Record<string, unknown> },
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS[code];
    this.details = opts?.details;
    this.extra = opts?.extra;
  }
}

export const errors = {
  validation: (details: { path: string; issue: string }[], message = "Invalid request.") =>
    new ApiError("VALIDATION_ERROR", message, { details }),
  unauthenticated: (message = "Sign in to continue.") => new ApiError("UNAUTHENTICATED", message),
  notFound: (what = "Resource") => new ApiError("NOT_FOUND", `${what} not found.`),
  conflict: (message: string, extra?: Record<string, unknown>) => new ApiError("CONFLICT", message, { extra }),
  rateLimited: (retryAfterSec: number) =>
    new ApiError("RATE_LIMITED", "Too many requests. Please slow down.", { extra: { retryAfter: retryAfterSec } }),
  aiUnavailable: (fallback?: unknown) =>
    new ApiError("AI_UNAVAILABLE", "The assistant is temporarily unavailable. Your records are safe.", {
      extra: fallback !== undefined ? { fallback } : undefined,
    }),
  internal: () => new ApiError("INTERNAL", "Something went wrong on our end."),
};

export interface ErrorPayload {
  error: { code: ApiErrorCode; message: string; details?: unknown; requestId: string } & Record<string, unknown>;
}

/** Map any thrown value to the wire-safe error envelope. */
export function toErrorPayload(err: unknown, requestId: string): { status: number; body: ErrorPayload } {
  if (err instanceof ApiError) {
    return {
      status: err.status,
      body: { error: { code: err.code, message: err.message, details: err.details, requestId, ...(err.extra ?? {}) } },
    };
  }
  // Unknown errors: log server-side, return generic envelope (no internals leaked).
  return {
    status: 500,
    body: { error: { code: "INTERNAL", message: "Something went wrong on our end.", requestId } },
  };
}
