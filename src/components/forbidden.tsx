export function Forbidden({ message }: { message: string }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-start justify-center gap-2 px-4">
      <h1 className="text-2xl font-semibold tracking-tight">403 — Forbidden</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{message}</p>
    </main>
  );
}
