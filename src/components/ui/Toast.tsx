"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cx } from "@/lib/cx";
import { X } from "@/components/ui/icons";

/**
 * Toasts (DESIGN_SYSTEM §5): non-blocking confirmations, `role="status"`
 * (polite) — error toasts escalate to `role="alert"`. Auto-dismiss ≥ 5 s with
 * an optional action (e.g. Undo) reachable before expiry.
 */
export type ToastTone = "default" | "success" | "error" | "info";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  action?: { label: string; onClick: () => void };
  durationMs?: number;
};

type ToastItem = ToastInput & { id: number };

type ToastContextValue = { toast: (input: ToastInput) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

const TONES: Record<ToastTone, string> = {
  default: "border-border bg-popover text-popover-foreground",
  success: "border-success/40 bg-success-surface text-success",
  error: "border-destructive/50 bg-danger-surface text-destructive",
  info: "border-info/40 bg-info-surface text-info",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timersRef = useRef<number[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = ++nextId;
      setItems((list) => [...list, { ...input, id }]);
      const duration = input.durationMs ?? (input.tone === "error" ? 8000 : 5000);
      const timer = window.setTimeout(() => dismiss(id), duration);
      timersRef.current.push(timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          {items
            .filter((item) => item.tone !== "error")
            .map((item) => (
              <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
            ))}
        </div>
        <div className="flex flex-col gap-2">
          {items
            .filter((item) => item.tone === "error")
            .map((item) => (
              <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
            ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const tone = item.tone ?? "default";
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cx(
        "pointer-events-auto flex items-start gap-3 rounded-lg border p-3 shadow-raised",
        TONES[tone],
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-dense font-semibold">{item.title}</p>
        {item.description && <p className="mt-0.5 text-xs opacity-90">{item.description}</p>}
        {item.action && (
          <button
            type="button"
            onClick={() => {
              item.action?.onClick();
              onDismiss();
            }}
            className={cx(
              "mt-2 rounded-md px-2 py-1 text-xs font-medium underline-offset-2 hover:underline",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            {item.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className={cx(
          "rounded-md p-0.5 opacity-70 hover:opacity-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
