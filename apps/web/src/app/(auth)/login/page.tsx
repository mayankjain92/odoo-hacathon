import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-[var(--af-muted)]">
          Email & password authentication. Signup creates Employee accounts only.
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
        <label className="block space-y-1 text-sm">
          <span>Password</span>
          <input
            type="password"
            className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2 outline-none focus:border-[var(--af-accent)]"
            placeholder="••••••••"
          />
        </label>
        <button
          type="button"
          className="w-full rounded-lg bg-[var(--af-accent)] py-2.5 font-medium text-[#042f2e]"
        >
          Continue
        </button>
        <Link
          href="/forgot-password"
          className="block text-center text-sm text-[var(--af-muted)] hover:text-[var(--af-accent)]"
        >
          Forgot password?
        </Link>
      </form>
      <p className="text-sm text-[var(--af-muted)]">
        No account?{" "}
        <Link href="/signup" className="text-[var(--af-accent)]">
          Create employee account
        </Link>
      </p>
    </main>
  );
}
