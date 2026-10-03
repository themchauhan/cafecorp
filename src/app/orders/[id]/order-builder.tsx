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
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="flex flex-col gap-4">
        {categories.map((category) => {
          const items = itemsByCategory.get(category.id) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={category.id} className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                {category.name}
              </h2>
              <div className="flex flex-wrap gap-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleAdd(item.id)}
                    disabled={isPending}
                    className="rounded border border-zinc-300 px-3 py-2 text-left text-sm disabled:opacity-50 dark:border-zinc-700"
                  >
                    {item.name}
                    <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                      {item.price.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-2 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-lg font-medium">Current order</h2>
        {order.items.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No items added yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {order.items.map((item, index) => (
              <li
                key={index}
                className="flex items-center justify-between gap-2"
              >
                <span>{item.name}</span>
                <span className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      handleQuantityChange(index, item.quantity - 1)
                    }
                    disabled={isPending}
                    aria-label={`Decrease ${item.name}`}
                    className="rounded border border-zinc-300 px-2 disabled:opacity-50 dark:border-zinc-700"
                  >
                    &minus;
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    onClick={() =>
                      handleQuantityChange(index, item.quantity + 1)
                    }
                    disabled={isPending}
                    aria-label={`Increase ${item.name}`}
                    className="rounded border border-zinc-300 px-2 disabled:opacity-50 dark:border-zinc-700"
                  >
                    +
                  </button>
                  <span className="w-16 text-right">
                    {(item.priceSnapshot * item.quantity).toFixed(2)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-zinc-200 pt-2 text-sm font-medium dark:border-zinc-800">
          Total: {total.toFixed(2)}
        </p>
        <button
          onClick={handleSendToKitchen}
          disabled={isPending || order.items.length === 0}
          className="self-start rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          Send to kitchen
        </button>
      </section>
    </div>
  );
}
