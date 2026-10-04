'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import type { Category, MenuItem } from '@/app/admin/menu/types';
import {
  addOrderItem,
  sendToKitchen,
  updateOrderItemQuantity,
} from '../actions';
import { orderTotal } from '../money';
import type { Order } from '../types';

export function OrderBuilder({
  order,
  categories,
  menuItems,
}: {
  order: Order;
  categories: Category[];
  menuItems: MenuItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of menuItems) {
      const list = map.get(item.categoryId) ?? [];
      list.push(item);
      map.set(item.categoryId, list);
    }
    return map;
  }, [menuItems]);

  const total = orderTotal(order.items);

  function handleAdd(menuItemId: string) {
    setError(null);
    startTransition(async () => {
      const result = await addOrderItem({
        orderId: order.id,
        menuItemId,
        quantity: 1,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleQuantityChange(index: number, quantity: number) {
    setError(null);
    startTransition(async () => {
      const result = await updateOrderItemQuantity({
        orderId: order.id,
        index,
        quantity,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleSendToKitchen() {
    setError(null);
    startTransition(async () => {
      const result = await sendToKitchen(order.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/orders/${order.id}/kot`);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p className="card border-[var(--color-danger-600)] p-3 text-sm text-[var(--color-danger-600)]">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-5">
        {categories.map((category) => {
          const items = itemsByCategory.get(category.id) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={category.id} className="flex flex-col gap-2">
              <h2 className="text-sm font-bold tracking-wide text-[var(--muted)] uppercase">
                {category.name}
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleAdd(item.id)}
                    disabled={isPending}
                    className="menu-item-tile"
                  >
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-[var(--color-brand-600)]">
                      {item.price.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="card flex flex-col gap-3 p-4">
        <h2 className="text-lg font-bold">Current order</h2>
        {order.items.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No items added yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {order.items.map((item, index) => (
              <li
                key={index}
                className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0"
              >
                <span className="font-medium">{item.name}</span>
                <span className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      handleQuantityChange(index, item.quantity - 1)
                    }
                    disabled={isPending}
                    aria-label={`Decrease ${item.name}`}
                    className="btn btn-icon btn-secondary"
                  >
                    &minus;
                  </button>
                  <span className="w-5 text-center font-semibold">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() =>
                      handleQuantityChange(index, item.quantity + 1)
                    }
                    disabled={isPending}
                    aria-label={`Increase ${item.name}`}
                    className="btn btn-icon btn-secondary"
                  >
                    +
                  </button>
                  <span className="w-16 text-right font-semibold">
                    {(item.priceSnapshot * item.quantity).toFixed(2)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="flex items-baseline justify-between border-t border-[var(--border)] pt-3 text-lg font-bold">
          <span>Total</span>
          <span>{total.toFixed(2)}</span>
        </p>
        <button
          onClick={handleSendToKitchen}
          disabled={isPending || order.items.length === 0}
          className="btn btn-primary"
        >
          Send to kitchen
        </button>
      </section>
    </div>
  );
}
