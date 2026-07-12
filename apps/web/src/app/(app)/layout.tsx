import Link from "next/link";

const nav = [
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

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-[var(--af-border)] bg-[var(--af-surface)]/80 p-5 md:block">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--af-accent)]"
        >
          AssetFlow
        </Link>
        <nav className="mt-8 flex flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm text-[var(--af-muted)] transition hover:bg-[var(--af-surface-elevated)] hover:text-[var(--af-text)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-[var(--af-border)] px-6">
          <p className="text-sm text-[var(--af-muted)]">Operational workspace</p>
          <Link href="/login" className="text-sm text-[var(--af-accent)]">
            Account
          </Link>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
