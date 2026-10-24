"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setUnauthorizedHandler, toApiError, type ApiError, type MeDto } from "@/client/api";
import { AppShell } from "@/components/layout/AppShell";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Authenticated shell (DESIGN_SPEC §0.3): resolves the session via the API
 * client (never the database), redirects to sign-in with a `next` target on
 * 401, and only renders children once the profile is known (FR-012).
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<MeDto | null>(null);
  const [fatal, setFatal] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  // 401s from any page navigate to sign-in through the client layer.
  useEffect(() => {
    setUnauthorizedHandler((target) => {
      router.replace(target);
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    setFatal(null);
    api
      .me()
      .then((profile) => {
        if (!cancelled) setUser(profile);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const apiError = toApiError(error);
        // 401 already redirects via the registered handler.
        if (apiError.code === "UNAUTHENTICATED") return;
        setFatal(apiError);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const signOut = useCallback(() => {
    void api.logout();
  }, []);

  if (fatal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <ErrorState error={fatal} onRetry={() => setAttempt((n) => n + 1)} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Spinner className="size-6" />
          <p className="text-dense" role="status">
            Checking your session…
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppShell user={user} onSignOut={signOut}>
      {children}
    </AppShell>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthGate>{children}</AuthGate>
      </ToastProvider>
    </ThemeProvider>
  );
}
