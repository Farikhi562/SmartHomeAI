import Link from "next/link";
import { CheckCircle, MapPin, Search, ShieldCheck, Sparkles } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

const linkButtonBase =
  "inline-flex h-10 items-center rounded-md px-5 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const VALUE_PROPS = [
  {
    icon: MapPin,
    title: "Record in seconds",
    body: "Note where you put an item the moment you put it there — manually or by telling the assistant.",
  },
  {
    icon: Search,
    title: "Ask in plain language",
    body: "“Where did I last put my motorcycle keys?” Answers come only from records you created.",
  },
  {
    icon: CheckCircle,
    title: "Honest about uncertainty",
    body: "Every answer links its source records and says “last recorded — it may have moved since”.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    body: "One owner per account with server-side isolation on every operation. Export or delete anytime.",
  },
];

const PRINCIPLES = [
  "Recorded facts, not guesses",
  "Honesty about uncertainty",
  "The dashboard is the product",
  "Private by default",
  "Graceful degradation",
];

/** Landing page (DESIGN_SPEC §1.1) — static, no client fetch. */
export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles size={14} aria-hidden="true" />
            Personal belongings memory
          </p>
          <h1 className="max-w-2xl text-3xl font-bold leading-9 text-foreground">
            Remember where you last put things.
          </h1>
          <p className="mt-4 max-w-prose text-lg text-muted-foreground">
            SmartHomeAI is a memory and record system, not a tracker. You record where you place
            everyday items; the assistant answers questions from those records — with the location,
            the time, and an honest caveat.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className={cx(linkButtonBase, "bg-primary text-primary-foreground hover:bg-primary-hover")}
            >
              Sign in to get started
            </Link>
            <a
              href="#how-it-works"
              className={cx(linkButtonBase, "border border-border-strong bg-card text-foreground hover:bg-muted")}
            >
              How it works
            </a>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Development preview: sign-in accepts any e-mail until Amazon Cognito is wired up (D5).
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
              <span className="ml-3 text-xs text-muted-foreground">Dashboard</span>
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
          <h2 className="text-2xl font-bold text-foreground">How it helps</h2>
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
          <h2 className="text-base font-semibold text-foreground">Built on five product principles</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
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
          <h2 className="text-2xl font-bold text-foreground">Start your own record</h2>
          <p className="mx-auto mt-2 max-w-prose text-base text-muted-foreground">
            Add a location, record your first item, and ask the assistant where you left it.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/login"
              className={cx(linkButtonBase, "bg-primary text-primary-foreground hover:bg-primary-hover")}
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
