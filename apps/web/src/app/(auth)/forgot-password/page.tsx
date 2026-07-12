import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
          Reset password
        </h1>
        <p className="mt-2 text-sm text-[var(--af-muted)]">
          Enter your email and we&apos;ll send a reset link.
        </p>
      </div>
      <form className="space-y-4 rounded-[var(--af-radius)] border border-[var(--af-border)] bg-[var(--af-surface)] p-6">
        <label className="block space-y-1 text-sm">
          <span>Email</span>
          <input
            type="email"
            className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2 outline-none focus:border-[var(--af-accent)]"
            placeholder="you@company.com"
          />
        </label>
        <button
          type="button"
          className="w-full rounded-lg bg-[var(--af-accent)] py-2.5 font-medium text-[#042f2e]"
        >
          Send reset link
        </button>
      </form>
      <p className="text-sm text-[var(--af-muted)]">
        Remembered it?{" "}
        <Link href="/login" className="text-[var(--af-accent)]">
          Sign in
        </Link>
      </p>
    </main>
  );
}
