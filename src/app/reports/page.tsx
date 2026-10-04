import { redirect } from 'next/navigation';
import { FieldPath } from 'firebase-admin/firestore';
import { Forbidden } from '@/components/forbidden';
import { adminDb } from '@/lib/firebase/admin';
import {
  AuthError,
  getSessionProfile,
  requireRole,
  requireTenantId,
} from '@/lib/auth/session';
import { dateKeyForDate, type DailySummary } from '@/lib/daily-summary';
import { aggregateSummaries } from './lib';

async function resolveNames(
  tenantId: string,
  collection: string,
  ids: string[],
): Promise<Map<string, string>> {
  const docs = await Promise.all(
    ids.map((id) =>
      adminDb.doc(`tenants/${tenantId}/${collection}/${id}`).get(),
    ),
  );
  return new Map(
    ids.map((id, index) => [id, (docs[index].data()?.name as string) ?? id]),
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const profile = await getSessionProfile();
  if (!profile) {
    redirect('/login');
  }

  let tenantId: string;
  try {
    requireRole(profile, ['ADMIN']);
    tenantId = requireTenantId(profile);
  } catch (error) {
    if (error instanceof AuthError) {
      return <Forbidden message={error.message} />;
    }
    throw error;
  }

  const today = dateKeyForDate(new Date());
  const fromKey = from || today;
  const toKey = to || today;

  const snap = await adminDb
    .collection(`tenants/${tenantId}/dailySummaries`)
    .where(FieldPath.documentId(), '>=', fromKey)
    .where(FieldPath.documentId(), '<=', toKey)
    .get();
  const summaries = snap.docs.map((doc) => doc.data() as DailySummary);
  const report = aggregateSummaries(summaries);

  const [staffName, itemName, categoryName] = await Promise.all([
    resolveNames(tenantId, 'profiles', Object.keys(report.totalsByStaff)),
    resolveNames(tenantId, 'menuItems', Object.keys(report.itemsSold)),
    resolveNames(tenantId, 'menuCategories', Object.keys(report.categorySales)),
  ]);

  const topItems = Object.entries(report.itemsSold)
    .map(([id, quantity]) => ({ id, name: itemName.get(id)!, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const categoryRows = Object.entries(report.categorySales)
    .map(([id, amount]) => ({ id, name: categoryName.get(id)!, amount }))
    .sort((a, b) => b.amount - a.amount);

  const staffRows = Object.entries(report.totalsByStaff)
    .map(([uid, amount]) => ({ uid, name: staffName.get(uid)!, amount }))
    .sort((a, b) => b.amount - a.amount);

  const modeRows = Object.entries(report.totalsByMode).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Reports</h1>

      <form
        method="GET"
        className="card flex flex-wrap items-end gap-3 p-4 text-sm"
      >
        <label className="flex flex-col gap-1 font-medium text-[var(--muted)]">
          From
          <input
            type="date"
            name="from"
            defaultValue={fromKey}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 font-medium text-[var(--muted)]">
          To
          <input type="date" name="to" defaultValue={toKey} className="input" />
        </label>
        <button type="submit" className="btn btn-primary">
          Update
        </button>
      </form>

      <section className="card flex flex-col gap-2 p-5">
        <h2 className="text-lg font-semibold">
          Collection{' '}
          {fromKey === toKey ? `on ${fromKey}` : `from ${fromKey} to ${toKey}`}
        </h2>
        <p className="text-2xl font-bold text-[var(--color-brand-600)]">
          {report.grandTotal.toFixed(2)}
        </p>
        {modeRows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No billed orders in range.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {modeRows.map(([mode, amount]) => (
              <li
                key={mode}
                className="flex justify-between border-t border-[var(--border)] py-1.5 first:border-t-0 first:pt-0"
              >
                <span>{mode}</span>
                <span className="font-semibold">{amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card flex flex-col gap-2 p-5">
        <h2 className="text-lg font-semibold">By staff</h2>
        {staffRows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No billed orders in range.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {staffRows.map((row) => (
              <li
                key={row.uid}
                className="flex justify-between border-t border-[var(--border)] py-1.5 first:border-t-0 first:pt-0"
              >
                <span>{row.name}</span>
                <span className="font-semibold">{row.amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card flex flex-col gap-2 p-5">
        <h2 className="text-lg font-semibold">Top-selling items</h2>
        {topItems.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No billed orders in range.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {topItems.map((item) => (
              <li
                key={item.id}
                className="flex justify-between border-t border-[var(--border)] py-1.5 first:border-t-0 first:pt-0"
              >
                <span>{item.name}</span>
                <span className="font-semibold">{item.quantity}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card flex flex-col gap-2 p-5">
        <h2 className="text-lg font-semibold">By category</h2>
        {categoryRows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No billed orders in range.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {categoryRows.map((row) => (
              <li
                key={row.id}
                className="flex justify-between border-t border-[var(--border)] py-1.5 first:border-t-0 first:pt-0"
              >
                <span>{row.name}</span>
                <span className="font-semibold">{row.amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
