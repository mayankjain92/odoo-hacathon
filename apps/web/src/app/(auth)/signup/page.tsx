import Link from "next/link";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
          Create account
        </h1>
        <p className="mt-2 text-sm text-[var(--af-muted)]">
          New users join as Employees. Admins promote roles from the directory.
        </p>
      </div>
      <form className="space-y-4 rounded-[var(--af-radius)] border border-[var(--af-border)] bg-[var(--af-surface)] p-6">
        <label className="block space-y-1 text-sm">
          <span>Full name</span>
          <input
            className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2 outline-none focus:border-[var(--af-accent)]"
            placeholder="Priya Sharma"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Email</span>
          <input
            type="email"
            className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2 outline-none focus:border-[var(--af-accent)]"
            placeholder="priya@company.com"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Password</span>
          <input
            type="password"
            className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2 outline-none focus:border-[var(--af-accent)]"
            placeholder="Min 8 characters"
          />
        </label>
        <button
          type="button"
          className="w-full rounded-lg bg-[var(--af-accent)] py-2.5 font-medium text-[#042f2e]"
        >
          Sign up
        </button>
      </form>
      <p className="text-sm text-[var(--af-muted)]">
        Already registered?{" "}
        <Link href="/login" className="text-[var(--af-accent)]">
          Sign in
        </Link>
      </p>
    </main>
  );
}
