'use client';

import { useState, useTransition } from 'react';
import { setTableActive, updateTable } from './actions';
import type { CafeTable } from './types';

function TableRow({ table }: { table: CafeTable }) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(table.label);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateTable({ id: table.id, label });
      if (!result.ok) {
        setError(result.error);
      } else {
        setEditing(false);
      }
    });
  }

  function toggleActive() {
    setError(null);
    startTransition(async () => {
      const result = await setTableActive({
        id: table.id,
        active: !table.active,
      });
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <tr className="border-t border-zinc-200 dark:border-zinc-800">
        <td className="py-2 pr-4">
          {editing ? (
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          ) : (
            table.label
          )}
        </td>
        <td className="py-2 pr-4">{table.active ? 'Active' : 'Inactive'}</td>
        <td className="py-2 pr-4">
          {editing ? (
            <button
              onClick={save}
              disabled={isPending}
              className="underline underline-offset-4"
            >
              Save
            </button>
          ) : (
            <button
              onClick={() => setEditing(true)}
              disabled={isPending}
              className="underline underline-offset-4"
            >
              Edit
            </button>
          )}
        </td>
        <td className="py-2">
          <button
            onClick={toggleActive}
            disabled={isPending}
            className="underline underline-offset-4 disabled:opacity-50"
          >
            {table.active ? 'Deactivate' : 'Activate'}
          </button>
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={4} className="pb-2 text-sm text-red-600">
            {error}
          </td>
        </tr>
      )}
    </>
  );
}

export function TableList({ tables }: { tables: CafeTable[] }) {
  if (tables.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">No tables yet.</p>
    );
  }

  return (
    <table className="w-full text-left text-sm">
      <thead className="text-zinc-500 dark:text-zinc-400">
        <tr>
          <th className="py-1 pr-4">Label</th>
          <th className="py-1 pr-4">Status</th>
          <th className="py-1 pr-4" />
          <th className="py-1" />
        </tr>
      </thead>
      <tbody>
        {tables.map((table) => (
          <TableRow key={table.id} table={table} />
        ))}
      </tbody>
    </table>
  );
}
