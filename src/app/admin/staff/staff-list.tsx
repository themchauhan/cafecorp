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
    <div className="card flex flex-col gap-2 p-4">
      {error && (
        <p className="text-sm text-[var(--color-danger-600)]">{error}</p>
      )}
      <table className="w-full text-left text-sm">
        <thead className="text-[var(--muted)]">
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
            <tr key={row.uid} className="border-t border-[var(--border)]">
              <td className="py-2 pr-4">{row.name}</td>
              <td className="py-2 pr-4">{row.email}</td>
              <td className="py-2 pr-4">{row.role}</td>
              <td className="py-2 pr-4">{row.status}</td>
              <td className="py-2">
                {row.uid !== currentUid && (
                  <button
                    onClick={() => toggle(row)}
                    disabled={isPending}
                    className={`btn btn-sm ${row.status === 'ACTIVE' ? 'btn-danger' : 'btn-secondary'}`}
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
