'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { CafeTable } from '@/app/admin/tables/types';

/**
 * No orderBy in the query (only an equality filter) so this never
 * needs a composite Firestore index deployed — same approach as the
 * Phase 3 kitchen board.
 */
export function TableStatusBoard({
  tenantId,
  tables,
}: {
  tenantId: string;
  tables: CafeTable[];
}) {
  const [occupied, setOccupied] = useState<Map<string, string> | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, `tenants/${tenantId}/orders`),
      where('status', 'in', ['OPEN', 'KOT_SENT', 'SERVED']),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const next = new Map<string, string>();
      for (const doc of snapshot.docs) {
        const data = doc.data() as { tableId?: string | null };
        if (data.tableId) next.set(data.tableId, doc.id);
      }
      setOccupied(next);
    });
    return unsubscribe;
  }, [tenantId]);

  if (occupied === null) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tables.map((table) => {
        const orderId = occupied.get(table.id);
        return (
          <div
            key={table.id}
            className={`card flex min-h-24 flex-col items-center justify-center gap-1.5 p-4 text-sm ${
              orderId
                ? 'border-[var(--color-warning-600)] bg-[var(--color-warning-50)]'
                : ''
            }`}
          >
            <span className="text-base font-bold">{table.label}</span>
            {orderId ? (
              <Link
                href={`/orders/${orderId}`}
                className="badge badge-kot hover:underline"
              >
                Occupied
              </Link>
            ) : (
              <span className="badge border border-[var(--border)] text-[var(--muted)]">
                Free
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
