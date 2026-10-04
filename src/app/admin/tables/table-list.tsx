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
      <tr className="border-t border-[var(--border)]">
        <td className="py-2 pr-4">
          {editing ? (
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="input w-auto"
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
              className="btn btn-sm btn-secondary"
            >
              Save
            </button>
          ) : (
            <button
              onClick={() => setEditing(true)}
              disabled={isPending}
              className="btn btn-sm btn-secondary"
            >
              Edit
            </button>
          )}
        </td>
        <td className="py-2">
          <button
            onClick={toggleActive}
            disabled={isPending}
            className={`btn btn-sm ${table.active ? 'btn-danger' : 'btn-secondary'}`}
          >
            {table.active ? 'Deactivate' : 'Activate'}
          </button>
        </td>
      </tr>
      {error && (
        <tr>
          <td
            colSpan={4}
            className="pb-2 text-sm text-[var(--color-danger-600)]"
          >
            {error}
          </td>
        </tr>
      )}
    </>
  );
}

export function TableList({ tables }: { tables: CafeTable[] }) {
  if (tables.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No tables yet.</p>;
  }

  return (
    <div className="card p-4">
      <table className="w-full text-left text-sm">
        <thead className="text-[var(--muted)]">
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
    </div>
  );
}
