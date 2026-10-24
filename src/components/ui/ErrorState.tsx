import type { ApiError} from "@/client/api";
import { toApiError } from "@/client/api";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, RotateCcw } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

/**
 * Inline error panel (DESIGN_SPEC §0.4): human-readable message from the error
 * envelope + `requestId` for support + Retry. Never leaks stack traces (FR-013).
 */
export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const apiError: ApiError = toApiError(error);
  const rateLimited = apiError.code === "RATE_LIMITED";
  const showRequestId = Boolean(apiError.requestId);

  return (
    <div
      role="alert"
      className={cx(
        "flex flex-col items-start gap-2 rounded-lg border border-destructive/40 bg-danger-surface p-4",
        className,
      )}
    >
      <p className="flex items-center gap-2 text-base font-semibold text-destructive">
        <AlertTriangle size={16} />
        {rateLimited ? "Terlalu banyak permintaan" : "Terjadi kesalahan"}
      </p>
      <p className="text-dense text-foreground">{apiError.message}</p>
      {rateLimited && apiError.retryAfterSec !== undefined && (
        <p className="text-dense text-muted-foreground">
          Coba lagi dalam {apiError.retryAfterSec} detik.
        </p>
      )}
      {showRequestId && (
        <p className="font-mono text-dense text-muted-foreground">
          ID permintaan: {apiError.requestId}
        </p>
      )}
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          iconLeft={<RotateCcw size={14} />}
          className="mt-1"
        >
          Coba lagi
        </Button>
      )}
    </div>
  );
}
