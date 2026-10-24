"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type FocusTrapOptions = {
  onEscape?: () => void;
  /** Where focus lands on open (defaults to `[data-dialog-initial-focus]`, else first focusable). */
  getInitialFocus?: () => HTMLElement | null;
};

/**
 * Simple focus trap (ACCESSIBILITY §3.3/§6.2): moves focus in, cycles Tab,
 * closes on Escape, locks page scroll, and restores focus to the opener.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  options?: FocusTrapOptions,
): void {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusables = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element !== document.body,
      );

    const initial =
      optionsRef.current?.getInitialFocus?.() ??
      container.querySelector<HTMLElement>("[data-dialog-initial-focus]") ??
      focusables()[0] ??
      container;
    initial.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        optionsRef.current?.onEscape?.();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        event.preventDefault();
        container.focus();
        return;
      }
      const activeElement = document.activeElement;
      const inside = activeElement instanceof Node && container.contains(activeElement);
      if (event.shiftKey) {
        if (!inside || activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!inside || activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [active, containerRef]);
}
