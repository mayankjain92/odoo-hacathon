export default function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
        {title}
      </h1>
      <p className="max-w-2xl text-[var(--af-muted)]">{description}</p>
      <div className="mt-6 rounded-[var(--af-radius)] border border-dashed border-[var(--af-border)] bg-[var(--af-surface)]/50 p-8 text-sm text-[var(--af-muted)]">
        Screen scaffold ready — implement against <code>@assetflow/shared</code>{" "}
        + TanStack Query.
      </div>
    </div>
  );
}
