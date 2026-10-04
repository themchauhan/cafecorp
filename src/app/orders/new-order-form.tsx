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
    <form
      onSubmit={handleSubmit}
      className="card flex flex-wrap items-end gap-3 p-4"
    >
      <select
        value={orderType}
        onChange={(event) => setOrderType(event.target.value as OrderType)}
        className="input w-auto"
      >
        {ORDER_TYPES.map((type) => (
          <option key={type} value={type}>
            {type.replace('_', '-')}
          </option>
        ))}
      </select>
      {orderType === 'DINE_IN' &&
        (activeTables.length === 0 ? (
          <p className="text-sm text-[var(--color-danger-600)]">
            No active tables — add one first.
          </p>
        ) : (
          <select
            value={tableId}
            onChange={(event) => setTableId(event.target.value)}
            className="input w-auto"
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
        className="btn btn-primary"
      >
        {loading ? 'Starting…' : 'Start order'}
      </button>
      {error && (
        <p className="w-full text-sm text-[var(--color-danger-600)]">{error}</p>
      )}
    </form>
  );
}
