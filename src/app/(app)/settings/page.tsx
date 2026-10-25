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
import { Download, Monitor, Moon, Sun } from "@/components/ui/icons";
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
  { value: "profile", label: "Profil" },
  { value: "preferences", label: "Preferensi" },
  { value: "privacy", label: "Privasi & data" },
];

const THEME_OPTIONS: ReadonlyArray<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "LIGHT", label: "Terang", icon: Sun },
  { value: "DARK", label: "Gelap", icon: Moon },
  { value: "SYSTEM", label: "Sistem", icon: Monitor },
];

const memberSince = (value: string) =>
  new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <>
      <PageHeader title="Pengaturan" subtitle="Akun, preferensi, dan data Anda." />

      <div role="tablist" aria-label="Bagian pengaturan" className="mb-5 flex flex-wrap gap-3 border-b border-border">
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
              "min-h-11 rounded-t-md px-3 py-2 text-base font-medium",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === option.value
                ? "border-b-2 border-primary font-semibold text-foreground"
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
      toast({ title: "Profil tersimpan", tone: "success" });
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
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-11 w-40" />
        </CardContent>
        <span role="status" className="sr-only">
          Memuat profil
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
        <CardTitle>Profil</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-5">
          {formError && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-danger-surface p-3 text-dense text-destructive">
              {formError}
            </p>
          )}

          <Input
            label="Email"
            value={me.email}
            disabled
            readOnly
            hint="Alamat email untuk masuk tidak bisa diubah di sini."
          />

          <Input
            label="Nama tampilan"
            placeholder="mis. Budi Santoso"
            maxLength={120}
            error={errors.displayName?.message}
            aria-invalid={errors.displayName ? true : undefined}
            {...register("displayName")}
          />

          <div>
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              Simpan perubahan
            </Button>
          </div>

          <p className="text-dense text-muted-foreground">
            Masuk sebagai {me.email}. Anggota sejak {memberSince(me.createdAt)}.
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
      toast({ title: "Preferensi tersimpan", tone: "success" });
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
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-11 w-52" />
        </CardContent>
        <span role="status" className="sr-only">
          Memuat preferensi
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
        <CardTitle>Preferensi</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {formError && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-danger-surface p-3 text-dense text-destructive">
            {formError}
          </p>
        )}

        <fieldset disabled={saving}>
          <legend className="text-base font-semibold text-foreground">Tema</legend>
          <p className="mt-1 text-dense text-muted-foreground">Berlaku langsung di seluruh aplikasi.</p>
          <div role="radiogroup" aria-label="Tema" className="mt-3 flex gap-3">
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
                    "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-base font-medium",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary bg-accent font-semibold text-accent-foreground"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon size={18} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">Tampilkan pertanyaan saran</p>
            <p className="text-dense text-muted-foreground">
              Contoh pertanyaan di atas kolom tulis pesan asisten.
            </p>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base font-medium text-foreground">
            <input
              type="checkbox"
              checked={prefs?.showSuggestedQuestions ?? true}
              onChange={(event) => void update({ showSuggestedQuestions: event.target.checked })}
              className="size-6 rounded border-input"
            />
            <span className="sr-only">Tampilkan pertanyaan saran</span>
            <span aria-hidden="true">{(prefs?.showSuggestedQuestions ?? true) ? "Aktif" : "Nonaktif"}</span>
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

function PrivacyPanel() {
  const { toast } = useToast();
  const meState = useAsync(() => api.me(), []);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  /**
   * FR-022: fetch the owner's export as a file download, then hand it to the
   * browser. The object URL is revoked once the download has started.
   */
  const downloadExport = async () => {
    setExporting(true);
    setExportError(null);
    let objectUrl: string | null = null;
    try {
      const file = await api.exportData();
      objectUrl = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = file.filename;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast({ title: "Ekspor diunduh", description: file.filename, tone: "success" });
    } catch (error) {
      setExportError(toApiError(error).message);
    } finally {
      setExporting(false);
      // Revoke only once the browser has had time to start the download;
      // revoking synchronously can cancel it in Safari/Firefox.
      const pendingUrl = objectUrl;
      if (pendingUrl) window.setTimeout(() => URL.revokeObjectURL(pendingUrl), 1500);
    }
  };

  return (
    <div className="flex max-w-[720px] flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Data yang kami simpan</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-base text-foreground">
          <p>
            Barang, lokasi, dan riwayat tempat Anda pernah mencatatnya. Percakapan dengan asisten
            juga disimpan agar Anda bisa melanjutkan dari mana terakhir berhenti.
          </p>
          <p>
            Riwayat lokasi bersifat <strong>hanya-tambah</strong>: entri tidak pernah diedit atau
            dihapus di tempat — Anda memperbaikinya dengan menambahkan catatan baru.
          </p>
          <p>Isi percakapan tidak pernah ditulis ke log aplikasi.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Penyimpanan &amp; penghapusan</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-base text-foreground">
          <p>
            Menghapus barang adalah penghapusan lunak: barang hilang dari tampilan segera dan
            dihapus permanen setelah <strong>30 hari</strong>. Selama itu Anda masih bisa
            memulihkannya.
          </p>
          <p>
            Anda bisa menghapus percakapan kapan saja dari halaman asisten — penghapusan itu bersifat
            permanen dan langsung.
          </p>
          <p>
            Menghapus akun langsung memblokir akses masuk, lalu seluruh data Anda dihapus permanen
            setelah masa tenggang <strong>7 hari</strong>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ekspor data Anda</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-base text-foreground">
          <p>
            Anda bisa mengunduh semua yang telah dicatat dalam format JSON — barang, lokasi, riwayat
            tempat, dan preferensi. Isi percakapan <strong>tidak disertakan secara bawaan</strong>{" "}
            agar ekspor tetap ringkas dan minim data pribadi.
          </p>
          {exportError && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-danger-surface p-3 text-dense text-destructive">
              {exportError}
            </p>
          )}
          <div>
            <Button
              variant="secondary"
              onClick={() => void downloadExport()}
              loading={exporting}
              iconLeft={<Download size={16} />}
            >
              Ekspor data
            </Button>
          </div>
          <p className="text-dense text-muted-foreground">
            Tunggu sebentar — berkas akan tersimpan di perangkat Anda.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Hapus akun</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-base text-foreground">
          <p>
            Ini langsung memblokir akses masuk Anda, lalu menghapus barang, lokasi, riwayat, dan
            percakapan secara permanen setelah masa tenggang 7 hari. Tindakan ini tidak bisa
            dibatalkan.
          </p>
          <p className="text-dense text-muted-foreground">
            Penghapusan akun belum tersedia di versi ini.
          </p>
          <div>
            <Button variant="danger" disabled>
              Hapus akun saya (segera hadir)
            </Button>
          </div>
        </CardContent>
      </Card>

      {meState.data && (
        <p className="text-dense text-muted-foreground">Masuk sebagai {meState.data.email}.</p>
      )}
      <p className="text-base">
        <Link
          href="/dashboard"
          className={cx(
            "inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
          )}
        >
          ← Kembali ke beranda
        </Link>
      </p>
    </div>
  );
}
