export function Forbidden({ message }: { message: string }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-start justify-center gap-2 px-4">
      <h1 className="text-2xl font-bold tracking-tight text-[var(--color-danger-600)]">
        403 — Forbidden
      </h1>
      <p className="text-[var(--muted)]">{message}</p>
    </main>
  );
}
