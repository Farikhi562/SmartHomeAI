import Link from "next/link";
import { CheckCircle, MapPin, Search, ShieldCheck, Sparkles } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

const linkButtonBase =
  "inline-flex min-h-11 items-center rounded-md px-5 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const VALUE_PROPS = [
  {
    icon: MapPin,
    title: "Catat dalam hitungan detik",
    body: "Tulis di mana Anda menaruh barang begitu Anda meletakkannya — lewat ketik, atau dengan memberi tahu asisten.",
  },
  {
    icon: Search,
    title: "Tanyakan dengan bahasa sehari-hari",
    body: "“Di mana saya terakhir menaruh kunci motor?” Jawaban diambil hanya dari catatan yang Anda buat sendiri.",
  },
  {
    icon: CheckCircle,
    title: "Jujur soal ketidakpastian",
    body: "Setiap jawaban menautkan catatan sumbernya dan menyebut “terakhir dicatat — bisa jadi sudah dipindahkan”.",
  },
  {
    icon: ShieldCheck,
    title: "Privat sejak awal",
    body: "Satu pemilik untuk satu akun, dengan pemisahan data di sisi server pada setiap operasi. Bisa diekspor atau dihapus kapan saja.",
  },
];

const PRINCIPLES = [
  "Fakta yang dicatat, bukan tebakan",
  "Jujur soal ketidakpastian",
  "Dasbor adalah inti produk",
  "Privat sejak awal",
  "Tetap berfungsi saat ada gangguan",
];

/** Landing page (DESIGN_SPEC §1.1) — static, no client fetch. */
export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-dense font-medium text-muted-foreground">
            <Sparkles size={14} aria-hidden="true" />
            Ingatan pribadi untuk barang-barang Anda
          </p>
          <h1 className="max-w-2xl text-3xl font-bold leading-9 text-foreground">
            Ingat di mana Anda terakhir menaruh barang.
          </h1>
          <p className="mt-4 max-w-prose text-lg text-muted-foreground">
            SmartHomeAI adalah sistem ingatan dan catatan, bukan alat pemantau. Anda mencatat di
            mana Anda menaruh barang sehari-hari; asisten menjawab pertanyaan dari catatan itu —
            lengkap dengan lokasinya, waktunya, dan peringatan jujur bila barangnya mungkin sudah
            berpindah.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className={cx(linkButtonBase, "bg-primary text-primary-foreground hover:bg-primary-hover")}
            >
              Masuk untuk memulai
            </Link>
            <a
              href="#how-it-works"
              className={cx(linkButtonBase, "border border-border-strong bg-card text-foreground hover:bg-muted")}
            >
              Cara kerjanya
            </a>
          </div>
          <p className="mt-4 text-dense text-muted-foreground">
            Pratinjau pengembangan: untuk sementara, Anda bisa masuk dengan surel apa pun.
          </p>
        </div>
      </section>

      {/* Product preview placeholder — decorative, no fabricated data */}
      <section aria-hidden="true" className="border-b border-border bg-background">
        <div className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-raised">
            <div className="flex h-10 items-center gap-2 border-b border-border bg-muted px-4">
              <span className="size-2.5 rounded-full bg-border-strong" />
              <span className="size-2.5 rounded-full bg-border-strong" />
              <span className="size-2.5 rounded-full bg-border-strong" />
              <span className="ml-3 text-xs text-muted-foreground">Beranda</span>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="h-20 rounded-md border border-border bg-muted" />
              ))}
              <div className="h-40 rounded-md border border-border bg-muted sm:col-span-2" />
              <div className="h-40 rounded-md border border-border bg-muted sm:col-span-2" />
            </div>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section id="how-it-works" className="border-b border-border bg-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold text-foreground">Bagaimana aplikasi ini membantu</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VALUE_PROPS.map((prop) => {
              const Icon = prop.icon;
              return (
                <div key={prop.title} className="rounded-lg border border-border bg-card p-5 shadow-subtle">
                  <span
                    className="mb-3 inline-flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground"
                    aria-hidden="true"
                  >
                    <Icon size={18} />
                  </span>
                  <h3 className="text-base font-semibold text-foreground">{prop.title}</h3>
                  <p className="mt-1.5 text-base text-muted-foreground">{prop.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Principles strip */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <h2 className="text-base font-semibold text-foreground">
            Dibangun atas lima prinsip produk
          </h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            {PRINCIPLES.map((principle) => (
              <li
                key={principle}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-dense text-muted-foreground"
              >
                {principle}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-foreground">Mulai catatan Anda sendiri</h2>
          <p className="mx-auto mt-2 max-w-prose text-base text-muted-foreground">
            Tambahkan satu lokasi, catat barang pertama Anda, lalu tanyakan ke asisten di mana Anda
            meletakkannya.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/login"
              className={cx(linkButtonBase, "bg-primary text-primary-foreground hover:bg-primary-hover")}
            >
              Masuk
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
