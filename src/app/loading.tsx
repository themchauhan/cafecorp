export default function Loading() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16">
      <div
        role="status"
        aria-label="Loading"
        className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-brand-100)] border-t-[var(--color-brand-600)]"
      />
      <p className="text-sm text-[var(--muted)]">Loading…</p>
    </main>
  );
}
