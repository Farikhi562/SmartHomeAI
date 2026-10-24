"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, toApiError } from "@/client/api";
import { useAsync } from "@/client/useAsync";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { AlertTriangle, List } from "@/components/ui/icons";
import { devLoginSchema } from "@/lib/validation";
import { cx } from "@/lib/cx";

/**
 * Sign-in (DESIGN_SPEC §2.1). The form follows GET /api/auth/config:
 *  - "dev": email only (any email signs in locally — D5 dev path);
 *  - "supabase": email + password, with an optional sign-up form (AC-001-4).
 */

const passwordLoginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(320),
  password: z.string().min(1, "Enter your password.").max(128),
});

const signupSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(320),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(128),
});

type DevForm = z.infer<typeof devLoginSchema>;
type PasswordForm = z.infer<typeof passwordLoginSchema>;
type SignupForm = z.infer<typeof signupSchema>;

function safeNext(value: string | null): string {
  // Same-origin paths only — never protocol-relative or absolute URLs.
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/dashboard";
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/40 bg-danger-surface p-3 text-dense text-destructive"
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const config = useAsync(() => api.authConfig(), []);
  const [formError, setFormError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signupNotice, setSignupNotice] = useState<string | null>(null);

  const next = safeNext(searchParams.get("next"));
  const authMode = config.data?.mode ?? "dev";
  const signupEnabled = config.data?.signupEnabled ?? false;

  const devForm = useForm<DevForm>({
    resolver: zodResolver(devLoginSchema),
    defaultValues: { email: "" },
    shouldFocusError: true,
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordLoginSchema),
    defaultValues: { email: "", password: "" },
    shouldFocusError: true,
  });

  const signupForm = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "" },
    shouldFocusError: true,
  });

  const handleAuthError = (error: unknown, fields: ReadonlyArray<"email" | "password">) => {
    const apiError = toApiError(error);
    const fieldIssue = fields
      .map((field) => apiError.issueFor(field))
      .find((issue): issue is string => Boolean(issue));
    if (apiError.code === "VALIDATION_ERROR" && fieldIssue) {
      const field = fields[0] ?? "email";
      if (mode === "signup") {
        signupForm.setError(field, { message: fieldIssue });
      } else if (authMode === "dev") {
        devForm.setError("email", { message: fieldIssue });
      } else {
        passwordForm.setError(field, { message: fieldIssue });
      }
      return;
    }
    if (apiError.code === "RATE_LIMITED" && apiError.retryAfterSec !== undefined) {
      setFormError(`Too many attempts — try again in ${apiError.retryAfterSec}s.`);
      return;
    }
    setFormError(apiError.message);
  };

  const onDevSubmit = async (values: DevForm) => {
    setFormError(null);
    setSignupNotice(null);
    try {
      await api.loginDev(values.email.trim());
      router.push(next);
      router.refresh();
    } catch (error) {
      handleAuthError(error, ["email"]);
    }
  };

  const onPasswordSubmit = async (values: PasswordForm) => {
    setFormError(null);
    setSignupNotice(null);
    try {
      await api.login(values.email.trim(), values.password);
      router.push(next);
      router.refresh();
    } catch (error) {
      handleAuthError(error, ["password", "email"]);
    }
  };

  const onSignupSubmit = async (values: SignupForm) => {
    setFormError(null);
    try {
      const result = await api.signup(values.email.trim(), values.password);
      if (result === "signed_in") {
        router.push(next);
        router.refresh();
        return;
      }
      setMode("signin");
      setSignupNotice("Check your inbox to confirm your email, then sign in.");
    } catch (error) {
      handleAuthError(error, ["password", "email"]);
    }
  };

  if (config.loading) {
    return (
      <div className="flex w-full max-w-[400px] items-center justify-center py-24" role="status">
        <Spinner className="size-6 text-muted-foreground" />
        <span className="sr-only">Loading sign-in options</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[400px]">
      <div className="mb-6 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground"
        >
          <List size={16} />
        </span>
        <span className="text-base font-semibold">SmartHomeAI</span>
      </div>

      <h1 className="text-2xl font-bold text-foreground">{mode === "signup" ? "Create your account" : "Sign in"}</h1>
      <p className="mt-1 text-base text-muted-foreground">
        {mode === "signup"
          ? "Track where everything lives — and ask when you forget."
          : "Open your inventory and ask where you left things."}
      </p>

      {/* Dev mode: email only. */}
      {authMode === "dev" && mode === "signin" && (
        <form
          onSubmit={devForm.handleSubmit(onDevSubmit)}
          noValidate
          className="mt-6 flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-subtle"
        >
          <FormError message={formError} />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            error={devForm.formState.errors.email?.message}
            aria-invalid={devForm.formState.errors.email ? true : undefined}
            {...devForm.register("email")}
          />
          <Button type="submit" loading={devForm.formState.isSubmitting} className="w-full">
            Sign in
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() =>
              devForm.setValue("email", "demo@smarthomeai.local", { shouldDirty: true, shouldValidate: false })
            }
          >
            Continue as demo
          </Button>
        </form>
      )}

      {/* Supabase mode: email + password (sign in or sign up). */}
      {authMode === "supabase" && mode === "signin" && (
        <form
          onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
          noValidate
          className="mt-6 flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-subtle"
        >
          <FormError message={formError ?? signupNotice} />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            error={passwordForm.formState.errors.email?.message}
            aria-invalid={passwordForm.formState.errors.email ? true : undefined}
            {...passwordForm.register("email")}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            error={passwordForm.formState.errors.password?.message}
            aria-invalid={passwordForm.formState.errors.password ? true : undefined}
            {...passwordForm.register("password")}
          />
          <Button type="submit" loading={passwordForm.formState.isSubmitting} className="w-full">
            Sign in
          </Button>
        </form>
      )}

      {authMode === "supabase" && mode === "signup" && (
        <form
          onSubmit={signupForm.handleSubmit(onSignupSubmit)}
          noValidate
          className="mt-6 flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-subtle"
        >
          <FormError message={formError} />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            error={signupForm.formState.errors.email?.message}
            aria-invalid={signupForm.formState.errors.email ? true : undefined}
            {...signupForm.register("email")}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters."
            error={signupForm.formState.errors.password?.message}
            aria-invalid={signupForm.formState.errors.password ? true : undefined}
            {...signupForm.register("password")}
          />
          <Button type="submit" loading={signupForm.formState.isSubmitting} className="w-full">
            Create account
          </Button>
        </form>
      )}

      {signupEnabled && (
        <p className="mt-4 text-center text-dense text-muted-foreground">
          {mode === "signin" ? (
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setFormError(null);
                setSignupNotice(null);
              }}
              className={cx(
                "text-primary underline-offset-4 hover:underline",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
              )}
            >
              Create an account
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setFormError(null);
              }}
              className={cx(
                "text-primary underline-offset-4 hover:underline",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
              )}
            >
              ← Back to sign in
            </button>
          )}
        </p>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        {authMode === "dev"
          ? "Development mode: any email signs you in; production uses Amazon Cognito (D5)."
          : "Sessions are held in a secure, httpOnly cookie."}
      </p>
      <p className="mt-3 text-xs">
        <Link
          href="/"
          className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          ← Back to home
        </Link>
      </p>
    </div>
  );
}

function SignInFallback() {
  return (
    <div className="w-full max-w-[400px]">
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" aria-hidden="true" />
      <div className="mt-4 h-24 w-full animate-pulse rounded-lg bg-muted" aria-hidden="true" />
      <span role="status" className="sr-only">
        Loading sign-in form
      </span>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <main id="main" className="flex flex-1 items-center justify-center px-4 py-12">
        <Suspense fallback={<SignInFallback />}>
          <SignInForm />
        </Suspense>
      </main>
      <footer className="px-4 pb-6 text-center text-xs text-muted-foreground">
        SmartHomeAI — answers reflect your last recorded locations.
      </footer>
    </div>
  );
}
