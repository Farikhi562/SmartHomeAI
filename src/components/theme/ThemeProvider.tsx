"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Theme context (FR-021, DESIGN_SYSTEM §6): light default, dark optional,
 * system supported. The inline script in `app/layout.tsx` applies the stored
 * value before first paint (no flash); this provider owns state afterwards.
 */
export type Theme = "LIGHT" | "DARK" | "SYSTEM";
export type ResolvedTheme = "LIGHT" | "DARK";

const STORAGE_KEY = "shai-theme";

type ThemeContextValue = {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isTheme(value: unknown): value is Theme {
  return value === "LIGHT" || value === "DARK" || value === "SYSTEM";
}

function readStoredTheme(): Theme {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (isTheme(value)) return value;
  } catch {
    /* storage blocked — fall back to the light default (D7) */
  }
  return "LIGHT";
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start at the documented default; hydrate the stored value right after mount.
  const [theme, setThemeState] = useState<Theme>("LIGHT");

  useEffect(() => {
    setThemeState(readStoredTheme());
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved: ResolvedTheme =
        theme === "SYSTEM" ? (media.matches ? "DARK" : "LIGHT") : theme;
      document.documentElement.classList.toggle("dark", resolved === "DARK");
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage blocked — the session keeps the in-memory value */
    }
  }, []);

  const resolved: ResolvedTheme = theme === "SYSTEM" ? (systemPrefersDark() ? "DARK" : "LIGHT") : theme;

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolved, setTheme }),
    [theme, resolved, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>");
  return context;
}
