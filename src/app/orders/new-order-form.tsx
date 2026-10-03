'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { CafeTable } from '@/app/admin/tables/types';
import { createOrder } from './actions';
import type { OrderType } from './types';

const ORDER_TYPES: OrderType[] = ['DINE_IN', 'TAKEAWAY', 'PARCEL'];

export function NewOrderForm({ activeTables }: { activeTables: CafeTable[] }) {
  const router = useRouter();
  const [orderType, setOrderType] = useState<OrderType>('TAKEAWAY');
  const [tableId, setTableId] = useState(activeTables[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await createOrder({
      orderType,
      tableId: orderType === 'DINE_IN' ? tableId : undefined,
    });
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push(`/orders/${result.data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <select
        value={orderType}
        onChange={(event) => setOrderType(event.target.value as OrderType)}
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        {ORDER_TYPES.map((type) => (
          <option key={type} value={type}>
            {type.replace('_', '-')}
          </option>
        ))}
      </select>
      {orderType === 'DINE_IN' &&
        (activeTables.length === 0 ? (
          <p className="text-sm text-red-600">
            No active tables — add one first.
          </p>
        ) : (
          <select
            value={tableId}
            onChange={(event) => setTableId(event.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {activeTables.map((table) => (
              <option key={table.id} value={table.id}>
                {table.label}
              </option>
            ))}
          </select>
        ))}
      <button
        type="submit"
        disabled={
          loading || (orderType === 'DINE_IN' && activeTables.length === 0)
        }
        className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {loading ? 'Starting…' : 'Start order'}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
