import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-start justify-center gap-4 px-4">
      <h1 className="text-2xl font-bold tracking-tight">
        404 — Page not found
      </h1>
      <p className="text-[var(--muted)]">That page doesn&apos;t exist.</p>
      <Link href="/" className="btn btn-primary">
        Back to dashboard
      </Link>
    </main>
  );
}
