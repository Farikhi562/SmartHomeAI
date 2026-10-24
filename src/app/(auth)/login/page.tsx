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

/**
 * Sign-in (DESIGN_SPEC §2.1). The form follows GET /api/auth/config:
 *  - "dev": email only (any email signs in locally — D5 dev path);
 *  - "supabase": email + password, with an optional sign-up form (AC-001-4).
 * Sign-up is offered as a full-width button (never a small text link).
 */

const passwordLoginSchema = z.object({
  email: z.string().trim().email("Masukkan alamat email yang valid.").max(320),
  password: z.string().min(1, "Masukkan kata sandi Anda.").max(128),
});

const signupSchema = z.object({
  email: z.string().trim().email("Masukkan alamat email yang valid.").max(320),
  password: z
    .string()
    .min(8, "Gunakan minimal 8 karakter.")
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
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
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
  const googleError =
    searchParams.get("error") === "google_not_configured"
      ? "Login Google belum dikonfigurasi di Supabase."
      : searchParams.get("error") === "google_session_expired"
        ? "Sesi login Google kedaluwarsa. Coba lagi."
        : searchParams.get("error")
          ? "Login Google gagal. Coba lagi."
          : null;

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
      setFormError(`Terlalu banyak percobaan. Coba lagi dalam ${apiError.retryAfterSec} detik.`);
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
      setSignupNotice("Pendaftaran berhasil. Cek kotak masuk atau folder spam untuk konfirmasi email, lalu masuk.");
    } catch (error) {
      handleAuthError(error, ["password", "email"]);
    }
  };

  const switchToSignup = () => {
    setMode("signup");
    setFormError(null);
    setSignupNotice(null);
  };

  const switchToSignin = () => {
    setMode("signin");
    setFormError(null);
    setSignupNotice(null);
  };

  if (config.loading) {
    return (
      <div className="flex w-full max-w-[400px] items-center justify-center gap-3 py-24" role="status">
        <Spinner className="size-6 text-muted-foreground" />
        <span className="text-base text-muted-foreground">Memuat…</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[400px]">
      <div className="mb-6 flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground"
        >
          <List size={18} />
        </span>
        <span className="text-lg font-semibold">SmartHomeAI</span>
      </div>

      <h1 className="text-2xl font-bold text-foreground">{mode === "signup" ? "Buat akun" : "Masuk"}</h1>
      <p className="mt-1 text-base text-foreground">
        {mode === "signup"
          ? "Catat barang dan lokasi Anda, lalu tanyakan saat lupa menyimpannya."
          : "Buka daftar barang Anda dan tanyakan di mana Anda meletakkannya."}
      </p>

      <div className="mt-4">
        <FormError message={googleError} />
      </div>

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
            placeholder="nama@contoh.com"
            error={devForm.formState.errors.email?.message}
            aria-invalid={devForm.formState.errors.email ? true : undefined}
            {...devForm.register("email")}
          />
          <Button type="submit" loading={devForm.formState.isSubmitting} className="w-full">
            Masuk
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() =>
              devForm.setValue("email", "demo@smarthomeai.local", { shouldDirty: true, shouldValidate: false })
            }
          >
            Masuk sebagai demo
          </Button>
        </form>
      )}

      {/* Supabase mode: email + password (sign in or sign up). */}
      {authMode === "supabase" && mode === "signin" && (
        <div className="mt-6 flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-subtle">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => {
              window.location.assign(`/api/auth/google/start?next=${encodeURIComponent(next)}`);
            }}
          >
            Lanjutkan dengan Google
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>atau dengan email</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} noValidate className="flex flex-col gap-4">
            <FormError message={formError ?? signupNotice} />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="nama@contoh.com"
            error={passwordForm.formState.errors.email?.message}
            aria-invalid={passwordForm.formState.errors.email ? true : undefined}
            {...passwordForm.register("email")}
          />
          <Input
            label="Kata sandi"
            type="password"
            autoComplete="current-password"
            error={passwordForm.formState.errors.password?.message}
            aria-invalid={passwordForm.formState.errors.password ? true : undefined}
            {...passwordForm.register("password")}
          />
          <Button type="submit" loading={passwordForm.formState.isSubmitting} className="w-full">
            Masuk
          </Button>
          </form>
        </div>
      )}

      {/* Primary sign-up entry point: a full-width button, never a tiny link. */}
      {signupEnabled && mode === "signin" && (
        <Button type="button" variant="secondary" className="mt-4 w-full" onClick={switchToSignup}>
          Belum punya akun? Daftar
        </Button>
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
            placeholder="nama@contoh.com"
            error={signupForm.formState.errors.email?.message}
            aria-invalid={signupForm.formState.errors.email ? true : undefined}
            {...signupForm.register("email")}
          />
          <Input
            label="Kata sandi"
            type="password"
            autoComplete="new-password"
            hint="Minimal 8 karakter."
            error={signupForm.formState.errors.password?.message}
            aria-invalid={signupForm.formState.errors.password ? true : undefined}
            {...signupForm.register("password")}
          />
          <Button type="submit" loading={signupForm.formState.isSubmitting} className="w-full">
            Daftar
          </Button>
        </form>
      )}

      {signupEnabled && mode === "signup" && (
        <Button type="button" variant="secondary" className="mt-4 w-full" onClick={switchToSignin}>
          Sudah punya akun? Masuk
        </Button>
      )}

      <p className="mt-5 text-dense text-muted-foreground">
        {authMode === "dev"
          ? "Mode pengembangan: email apa pun bisa digunakan untuk masuk; versi produksi memakai Amazon Cognito (D5)."
          : "Sesi disimpan di cookie httpOnly yang aman."}
      </p>
      <p className="mt-3 text-base">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          Kembali ke beranda
        </Link>
      </p>
    </div>
  );
}

function SignInFallback() {
  return (
    <div className="w-full max-w-[400px]">
      <div className="h-9 w-44 animate-pulse rounded-md bg-muted" aria-hidden="true" />
      <div className="mt-4 h-24 w-full animate-pulse rounded-lg bg-muted" aria-hidden="true" />
      <span role="status" className="sr-only">
        Memuat formulir masuk
      </span>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a href="#main" className="skip-link">
        Lewati ke konten utama
      </a>
      <main id="main" className="flex flex-1 items-center justify-center px-4 py-12">
        <Suspense fallback={<SignInFallback />}>
          <SignInForm />
        </Suspense>
      </main>
      <footer className="px-4 pb-8 text-center text-dense text-muted-foreground">
        SmartHomeAI — jawaban mengikuti lokasi yang terakhir Anda catat.
      </footer>
    </div>
  );
}
