'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { CheckBadgeIcon, FlameBadgeIcon } from '@/components/icons';
import { formatElapsed } from './timer';

/**
 * Compact "what's going on in the kitchen" widget for the dashboard —
 * just the counts, not full ticket cards (see kitchen-board.tsx for
 * the full view). Lets staff/admin gauge the wait without leaving the
 * dashboard. Same live query shape as the Kitchen Board.
 */
export function KitchenSnapshot({ tenantId }: { tenantId: string }) {
  const [counts, setCounts] = useState<{
    cooking: number;
    ready: number;
    oldestCookingAtMs: number | null;
  } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, `tenants/${tenantId}/orders`),
      where('status', 'in', ['KOT_SENT', 'SERVED']),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let cooking = 0;
      let ready = 0;
      let oldestKotSentAt: Timestamp | null = null;
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.status === 'KOT_SENT') {
          cooking += 1;
          const kotSentAt = data.kotSentAt as Timestamp | undefined;
          if (
            kotSentAt &&
            (!oldestKotSentAt ||
              kotSentAt.toMillis() < oldestKotSentAt.toMillis())
          ) {
            oldestKotSentAt = kotSentAt;
          }
        } else if (data.status === 'SERVED') {
          ready += 1;
        }
      }
      setCounts({
        cooking,
        ready,
        oldestCookingAtMs: oldestKotSentAt ? oldestKotSentAt.toMillis() : null,
      });
    });
    return unsubscribe;
  }, [tenantId]);

  return (
    <Link
      href="/kitchen"
      className="card flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm font-semibold hover:border-[var(--color-brand-500)]"
    >
      <span className="flex items-center gap-2 text-[var(--color-warning-700)]">
        <FlameBadgeIcon />
        {counts === null ? '…' : counts.cooking} cooking
        {counts?.oldestCookingAtMs != null &&
          ` · oldest ${formatElapsed(now - counts.oldestCookingAtMs)}`}
      </span>
      <span className="flex items-center gap-2 text-[var(--color-success-700)]">
        <CheckBadgeIcon />
        {counts === null ? '…' : counts.ready} ready to serve
      </span>
      <span className="ml-auto text-xs font-medium text-[var(--muted)]">
        Open kitchen board →
      </span>
    </Link>
  );
}
