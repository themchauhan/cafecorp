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
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tables.map((table) => {
        const orderId = occupied.get(table.id);
        return (
          <div
            key={table.id}
            className={`flex flex-col items-center gap-1 rounded border p-4 text-sm ${
              orderId
                ? 'border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950'
                : 'border-zinc-200 dark:border-zinc-800'
            }`}
          >
            <span className="font-medium">{table.label}</span>
            {orderId ? (
              <Link
                href={`/orders/${orderId}`}
                className="text-xs underline underline-offset-4"
              >
                Occupied
              </Link>
            ) : (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Free
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
