"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, toApiError, type PreferencesDto } from "@/client/api";
import { useAsync } from "@/client/useAsync";
import { PageHeader } from "@/components/layout/PageHeader";
import { useTheme, type Theme } from "@/components/theme/ThemeProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Monitor, Moon, Sun } from "@/components/ui/icons";
import { profileUpdateSchema, type PreferencesUpdate, type ProfileUpdate } from "@/lib/validation";
import { cx } from "@/lib/cx";

/**
 * Settings (DESIGN_SPEC §1.13): profile, display preferences, and the privacy
 * / data-exit promises. Theme changes apply instantly and persist to the
 * server (FR-021) as well as local storage. Destructive actions sit behind
 * explicit confirmation dialogs with plain consequence copy.
 */

type Tab = "profile" | "preferences" | "privacy";

const TABS: ReadonlyArray<{ value: Tab; label: string }> = [
  { value: "profile", label: "Profile" },
  { value: "preferences", label: "Preferences" },
  { value: "privacy", label: "Privacy & data" },
];

const THEME_OPTIONS: ReadonlyArray<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "LIGHT", label: "Light", icon: Sun },
  { value: "DARK", label: "Dark", icon: Moon },
  { value: "SYSTEM", label: "System", icon: Monitor },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <>
      <PageHeader title="Settings" subtitle="Your account, preferences, and data." />

      <div role="tablist" aria-label="Settings sections" className="mb-5 flex gap-1 border-b border-border">
        {TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            id={`tab-${option.value}`}
            aria-selected={tab === option.value}
            aria-controls={`panel-${option.value}`}
            onClick={() => setTab(option.value)}
            className={cx(
              "rounded-t-md px-4 py-2 text-dense font-medium",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === option.value
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "profile" && <ProfilePanel />}
        {tab === "preferences" && <PreferencesPanel />}
        {tab === "privacy" && <PrivacyPanel />}
      </div>
    </>
  );
}

function ProfilePanel() {
  const { toast } = useToast();
  const meState = useAsync(() => api.me(), []);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileUpdate>({
    resolver: zodResolver(profileUpdateSchema),
    shouldFocusError: true,
  });

  useEffect(() => {
    if (meState.data) {
      reset({ displayName: meState.data.displayName ?? "" });
    }
  }, [meState.data, reset]);

  const submit = async (values: ProfileUpdate) => {
    setFormError(null);
    try {
      const updated = await api.updateMe({ displayName: values.displayName?.trim() || undefined });
      reset({ displayName: updated.displayName ?? "" });
      toast({ title: "Profile saved", tone: "success" });
    } catch (error) {
      const apiError = toApiError(error);
      const issue = apiError.issueFor("displayName");
      if (apiError.code === "VALIDATION_ERROR" && issue) setError("displayName", { message: issue });
      else setFormError(apiError.message);
    }
  };

  if (meState.loading) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-9 w-32" />
        </CardContent>
        <span role="status" className="sr-only">
          Loading profile
        </span>
      </Card>
    );
  }

  if (meState.error || !meState.data) {
    return <ErrorState error={meState.error} onRetry={meState.reload} />;
  }

  const me = meState.data;

  return (
    <Card className="max-w-[560px]">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          {formError && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-danger-surface p-3 text-dense text-destructive">
              {formError}
            </p>
          )}

          <Input label="Email" value={me.email} disabled readOnly hint="Your sign-in address can't be changed here." />

          <Input
            label="Display name"
            placeholder="e.g. Sam Rivera"
            maxLength={120}
            error={errors.displayName?.message}
            aria-invalid={errors.displayName ? true : undefined}
            {...register("displayName")}
          />

          <div>
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              Save changes
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Signed in as {me.email}. Member since{" "}
            {new Date(me.createdAt).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

function PreferencesPanel() {
  const router = useRouter();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const prefsState = useAsync(() => api.preferences(), []);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const update = async (patch: PreferencesUpdate) => {
    setFormError(null);
    setSaving(true);
    try {
      await api.updatePreferences(patch);
      toast({ title: "Preference saved", tone: "success" });
      prefsState.reload();
      router.refresh();
    } catch (error) {
      setFormError(toApiError(error).message);
    } finally {
      setSaving(false);
    }
  };

  if (prefsState.loading) {
    return (
      <Card className="max-w-[560px]">
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-9 w-48" />
        </CardContent>
        <span role="status" className="sr-only">
          Loading preferences
        </span>
      </Card>
    );
  }

  if (prefsState.error) {
    return <ErrorState error={prefsState.error} onRetry={prefsState.reload} />;
  }

  const prefs: PreferencesDto | null = prefsState.data;

  return (
    <Card className="max-w-[560px]">
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {formError && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-danger-surface p-3 text-dense text-destructive">
            {formError}
          </p>
        )}

        <fieldset disabled={saving}>
          <legend className="text-dense font-medium text-foreground">Theme</legend>
          <p className="mt-1 text-xs text-muted-foreground">Applies instantly across the app.</p>
          <div role="radiogroup" aria-label="Theme" className="mt-2 flex gap-2">
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setTheme(option.value);
                    void update({ theme: option.value });
                  }}
                  className={cx(
                    "flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-dense font-medium",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icon size={16} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
          <div>
            <p className="text-dense font-medium text-foreground">Show suggested questions</p>
            <p className="text-xs text-muted-foreground">
              Example prompts above the assistant composer (FR-021).
            </p>
          </div>
          <label className="flex items-center gap-2 text-dense text-muted-foreground">
            <input
              type="checkbox"
              checked={prefs?.showSuggestedQuestions ?? true}
              onChange={(event) => void update({ showSuggestedQuestions: event.target.checked })}
              className="size-4 rounded border-input"
            />
            <span className="sr-only">Show suggested questions</span>
            {(prefs?.showSuggestedQuestions ?? true) ? "On" : "Off"}
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

function PrivacyPanel() {
  const meState = useAsync(() => api.me(), []);

  return (
    <div className="flex max-w-[720px] flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>What we store</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-dense text-foreground">
          <p>
            Your items, locations, and the history of where you recorded them. Your assistant
            conversations, so you can pick up where you left off.
          </p>
          <p>
            Location history is <strong>append-only</strong>: entries are never edited or deleted in
            place — you correct a record by adding a new one.
          </p>
          <p>
            Conversation content is never written to application logs (FR-023.3).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retention & deletion</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-dense text-foreground">
          <p>
            Deleting an item is a soft delete: it disappears from your views immediately and is
            permanently purged after <strong>30 days</strong> (BR-07). You can restore it in the
            meantime.
          </p>
          <p>
            You can delete a conversation at any time from the assistant — that is a permanent,
            immediate deletion of its messages (FR-023).
          </p>
          <p>
            Deleting your account blocks sign-in immediately, then fully purges your data after a{" "}
            <strong>7-day</strong> grace period (FR-014.1).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export your data</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-dense text-foreground">
          <p>
            You can download everything you&apos;ve recorded as JSON — items, locations, events, and
            preferences. Conversations are excluded by default to keep the export minimal (FR-022).
          </p>
          <p className="text-xs text-muted-foreground">
            Export is a P1 feature and isn&apos;t wired up yet in this build.
          </p>
          <div>
            <Button variant="secondary" disabled>
              Export data (coming soon)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Delete account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-dense text-foreground">
          <p>
            This blocks your sign-in immediately, then permanently deletes your items, locations,
            history, and conversations after a 7-day grace period. It cannot be undone.
          </p>
          <p className="text-xs text-muted-foreground">
            Account deletion is a P1 feature and isn&apos;t wired up yet in this build.
          </p>
          <div>
            <Button variant="danger" disabled>
              Delete my account (coming soon)
            </Button>
          </div>
        </CardContent>
      </Card>

      {meState.data && (
        <p className="text-xs text-muted-foreground">
          Signed in as {meState.data.email}.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        <Link
          href="/dashboard"
          className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
