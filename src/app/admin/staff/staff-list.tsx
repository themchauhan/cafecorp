'use client';

import { useState, useTransition } from 'react';
import { setStaffStatus } from './actions';

export type StaffRow = {
  uid: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'STAFF';
  status: 'ACTIVE' | 'DEACTIVATED';
};

export function StaffList({
  staff,
  currentUid,
}: {
  staff: StaffRow[];
  currentUid: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(row: StaffRow) {
    setError(null);
    startTransition(async () => {
      const result = await setStaffStatus({
        uid: row.uid,
        status: row.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE',
      });
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <table className="w-full text-left text-sm">
        <thead className="text-zinc-500 dark:text-zinc-400">
          <tr>
            <th className="py-1 pr-4">Name</th>
            <th className="py-1 pr-4">Email</th>
            <th className="py-1 pr-4">Role</th>
            <th className="py-1 pr-4">Status</th>
            <th className="py-1" />
          </tr>
        </thead>
        <tbody>
          {staff.map((row) => (
            <tr
              key={row.uid}
              className="border-t border-zinc-200 dark:border-zinc-800"
            >
              <td className="py-2 pr-4">{row.name}</td>
              <td className="py-2 pr-4">{row.email}</td>
              <td className="py-2 pr-4">{row.role}</td>
              <td className="py-2 pr-4">{row.status}</td>
              <td className="py-2">
                {row.uid !== currentUid && (
                  <button
                    onClick={() => toggle(row)}
                    disabled={isPending}
                    className="text-sm underline underline-offset-4 disabled:opacity-50"
                  >
                    {row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
