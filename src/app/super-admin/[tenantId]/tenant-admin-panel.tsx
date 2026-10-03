'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { ActionResult } from '@/lib/action-result';
import {
  changeTenantPlan,
  inviteTenantAdmin,
  recordSubscriptionPayment,
  setTenantExpiry,
  setTenantStatus,
} from '../actions';
import type { SubscriptionPayment, Tenant } from '../types';

export function TenantAdminPanel({
  tenant,
  payments,
}: {
  tenant: Tenant;
  payments: SubscriptionPayment[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(action: () => Promise<ActionResult>) {
    setError(null);
    setLoading(true);
    const result = await action();
    if (!result.ok) {
      setError(result.error);
    } else {
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-8">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Status</h2>
        <button
          onClick={() =>
            run(() =>
              setTenantStatus({
                tenantId: tenant.id,
                status: tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
              }),
            )
          }
          disabled={loading}
          className="self-start rounded border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          {tenant.status === 'ACTIVE' ? 'Suspend tenant' : 'Reactivate tenant'}
        </button>
      </section>

      <PlanForm tenant={tenant} loading={loading} run={run} />
      <ExpiryForm tenant={tenant} loading={loading} run={run} />
      <InviteAdminForm
        tenantId={tenant.id}
        loading={loading}
        setLoading={setLoading}
        setError={setError}
      />
      <PaymentForm tenantId={tenant.id} loading={loading} run={run} />

      <section className="flex flex-col gap-2 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-lg font-medium">Payment history</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No payments recorded yet.
          </p>
        ) : (
          <ul className="text-sm">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex justify-between border-t border-zinc-200 py-1 dark:border-zinc-800"
              >
                <span>
                  {payment.amount.toFixed(2)} via {payment.paymentMethod} (
                  {payment.referenceNumber})
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {payment.periodStart.slice(0, 10)} &rarr;{' '}
                  {payment.periodEnd.slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PlanForm({
  tenant,
  loading,
  run,
}: {
  tenant: Tenant;
  loading: boolean;
  run: (action: () => Promise<ActionResult>) => Promise<void>;
}) {
  const [plan, setPlan] = useState<'TRIAL' | 'PAID'>(
    tenant.plan === 'PAID' ? 'PAID' : 'TRIAL',
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await run(() => changeTenantPlan({ tenantId: tenant.id, plan }));
  }

  return (
    <section className="flex flex-col gap-2 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h2 className="text-lg font-medium">Plan</h2>
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <select
          value={plan}
          onChange={(event) => setPlan(event.target.value as 'TRIAL' | 'PAID')}
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="TRIAL">Trial</option>
          <option value="PAID">Paid</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          Save plan
        </button>
      </form>
    </section>
  );
}

function ExpiryForm({
  tenant,
  loading,
  run,
}: {
  tenant: Tenant;
  loading: boolean;
  run: (action: () => Promise<ActionResult>) => Promise<void>;
}) {
  const [date, setDate] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const field =
      tenant.plan === 'TRIAL'
        ? { trialEndsAt: date }
        : { subscriptionEndsAt: date };
    await run(() => setTenantExpiry({ tenantId: tenant.id, ...field }));
  }

  return (
    <section className="flex flex-col gap-2 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h2 className="text-lg font-medium">
        {tenant.plan === 'TRIAL' ? 'Trial end date' : 'Subscription end date'}
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Manual adjustment, no payment record (e.g. a goodwill extension).
      </p>
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <input
          type="date"
          required
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          Save date
        </button>
      </form>
    </section>
  );
}

function InviteAdminForm({
  tenantId,
  loading,
  setLoading,
  setError,
}: {
  tenantId: string;
  loading: boolean;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [resetLink, setResetLink] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setResetLink(null);
    setLoading(true);
    const result = await inviteTenantAdmin({ tenantId, name, email });
    if (!result.ok) {
      setError(result.error);
    } else {
      setResetLink(result.data.resetLink);
      setName('');
      setEmail('');
    }
    setLoading(false);
  }

  return (
    <section className="flex flex-col gap-2 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h2 className="text-lg font-medium">Invite an admin</h2>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <input
          type="text"
          required
          placeholder="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          Invite
        </button>
      </form>
      {resetLink && (
        <div className="rounded border border-zinc-300 p-3 text-sm dark:border-zinc-700">
          <p className="mb-1 text-zinc-600 dark:text-zinc-400">
            No email is sent automatically — share this one-time password-setup
            link:
          </p>
          <code data-testid="admin-reset-link" className="break-all">
            {resetLink}
          </code>
        </div>
      )}
    </section>
  );
}

function PaymentForm({
  tenantId,
  loading,
  run,
}: {
  tenantId: string;
  loading: boolean;
  run: (action: () => Promise<ActionResult>) => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await run(() =>
      recordSubscriptionPayment({
        tenantId,
        amount: Number(amount),
        paymentMethod,
        referenceNumber,
        periodStart,
        periodEnd,
      }),
    );
    setAmount('');
    setReferenceNumber('');
  }

  return (
    <section className="flex flex-col gap-2 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h2 className="text-lg font-medium">Record a subscription payment</h2>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <input
          type="number"
          required
          min="0.01"
          step="0.01"
          placeholder="Amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="w-28 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          value={paymentMethod}
          onChange={(event) => setPaymentMethod(event.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="UPI">UPI</option>
          <option value="BANK_TRANSFER">Bank transfer</option>
          <option value="CASH">Cash</option>
          <option value="OTHER">Other</option>
        </select>
        <input
          type="text"
          required
          placeholder="Reference number"
          value={referenceNumber}
          onChange={(event) => setReferenceNumber(event.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          Period start
          <input
            type="date"
            required
            value={periodStart}
            onChange={(event) => setPeriodStart(event.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          Period end
          <input
            type="date"
            required
            value={periodEnd}
            onChange={(event) => setPeriodEnd(event.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          Record payment
        </button>
      </form>
    </section>
  );
}
