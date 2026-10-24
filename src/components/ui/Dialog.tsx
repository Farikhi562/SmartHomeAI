"use client";

import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/lib/cx";
import { X } from "@/components/ui/icons";
import { useFocusTrap } from "@/components/ui/useFocusTrap";

/**
 * Accessible modal dialog (ACCESSIBILITY §6.2): role=dialog, aria-modal,
 * labelled by its title, described by the consequence copy, focus trapped and
 * restored, Escape + backdrop click close, scroll locked.
 */
export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Focus this control on open (use for Cancel in destructive dialogs). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  initialFocusRef,
  className,
}: DialogProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useFocusTrap(containerRef, open && mounted, {
    onEscape: onClose,
    getInitialFocus: initialFocusRef ? () => initialFocusRef.current : undefined,
  });

  if (!open || !mounted) return null;

  const onBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center sm:p-6"
      onMouseDown={onBackdropMouseDown}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cx(
          "max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-popover p-5 shadow-overlay",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} tabIndex={-1} data-dialog-initial-focus className="text-lg font-semibold text-popover-foreground outline-none">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className={cx(
              "-mr-2 -mt-1 rounded-md p-3 text-muted-foreground hover:bg-muted hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <X size={20} />
          </button>
        </div>
        {description && (
          <p id={descriptionId} className="mt-1 text-dense text-muted-foreground">
            {description}
          </p>
        )}
        {children && <div className="mt-4">{children}</div>}
        {footer && (
          <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-border pt-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
