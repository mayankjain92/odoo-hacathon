import Link from "next/link";
import { brand } from "@assetflow/ui";

const routes = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/assets", label: "Assets" },
  { href: "/allocations", label: "Allocations" },
  { href: "/bookings", label: "Bookings" },
  { href: "/maintenance", label: "Maintenance" },
  { href: "/audits", label: "Audits" },
  { href: "/reports", label: "Reports" },
  { href: "/notifications", label: "Notifications" },
  { href: "/org", label: "Organization" },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-10 px-6 py-16">
      <div className="space-y-4">
        <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-[var(--af-accent)] uppercase">
          Enterprise ERP
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-5xl font-semibold tracking-tight md:text-7xl">
          {brand.name}
        </h1>
        <p className="max-w-xl text-lg text-[var(--af-muted)]">{brand.tagline}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/login"
          className="rounded-[var(--af-radius)] bg-[var(--af-accent)] px-5 py-3 font-medium text-[#042f2e] transition hover:bg-[var(--af-accent-hover)]"
        >
          Sign in
        </Link>
        <Link
          href="/dashboard"
          className="rounded-[var(--af-radius)] border border-[var(--af-border)] bg-[var(--af-surface)] px-5 py-3 font-medium transition hover:bg-[var(--af-surface-elevated)]"
        >
          Open app shell
        </Link>
      </div>

      <section className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
        {routes.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className="rounded-[var(--af-radius)] border border-[var(--af-border)]/60 bg-[var(--af-surface)]/60 px-4 py-3 text-sm text-[var(--af-muted)] transition hover:border-[var(--af-accent)]/40 hover:text-[var(--af-text)]"
          >
            {route.label}
          </Link>
        ))}
      </section>
    </main>
  );
}
