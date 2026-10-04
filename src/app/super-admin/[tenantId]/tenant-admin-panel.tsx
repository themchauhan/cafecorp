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
    <div className="flex flex-col gap-6">
      {error && (
        <p className="card p-3 text-sm text-[var(--color-danger-600)]">
          {error}
        </p>
      )}

      <section className="card flex flex-col gap-2 p-5">
        <h2 className="text-lg font-semibold">Status</h2>
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
          className={`btn self-start ${
            tenant.status === 'ACTIVE' ? 'btn-danger' : 'btn-secondary'
          }`}
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

      <section className="card flex flex-col gap-2 p-5">
        <h2 className="text-lg font-semibold">Payment history</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No payments recorded yet.
          </p>
        ) : (
          <ul className="flex flex-col text-sm">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex justify-between border-t border-[var(--border)] py-2 first:border-t-0 first:pt-0"
              >
                <span>
                  {payment.amount.toFixed(2)} via {payment.paymentMethod} (
                  {payment.referenceNumber})
                </span>
                <span className="text-[var(--muted)]">
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
    <section className="card flex flex-col gap-2 p-5">
      <h2 className="text-lg font-semibold">Plan</h2>
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <select
          value={plan}
          onChange={(event) => setPlan(event.target.value as 'TRIAL' | 'PAID')}
          className="input w-auto text-sm"
        >
          <option value="TRIAL">Trial</option>
          <option value="PAID">Paid</option>
        </select>
        <button type="submit" disabled={loading} className="btn btn-primary">
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
    <section className="card flex flex-col gap-2 p-5">
      <h2 className="text-lg font-semibold">
        {tenant.plan === 'TRIAL' ? 'Trial end date' : 'Subscription end date'}
      </h2>
      <p className="text-sm text-[var(--muted)]">
        Manual adjustment, no payment record (e.g. a goodwill extension).
      </p>
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <input
          type="date"
          required
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="input w-auto text-sm"
        />
        <button type="submit" disabled={loading} className="btn btn-primary">
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
    <section className="card flex flex-col gap-2 p-5">
      <h2 className="text-lg font-semibold">Invite an admin</h2>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <input
          type="text"
          required
          placeholder="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="input w-auto flex-1 text-sm"
        />
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="input w-auto flex-1 text-sm"
        />
        <button type="submit" disabled={loading} className="btn btn-primary">
          Invite
        </button>
      </form>
      {resetLink && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--color-brand-50)] p-3 text-sm">
          <p className="mb-1 text-[var(--muted)]">
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
    <section className="card flex flex-col gap-2 p-5">
      <h2 className="text-lg font-semibold">Record a subscription payment</h2>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <input
          type="number"
          required
          min="0.01"
          step="0.01"
          placeholder="Amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="input w-28 text-sm"
        />
        <select
          value={paymentMethod}
          onChange={(event) => setPaymentMethod(event.target.value)}
          className="input w-auto text-sm"
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
          className="input w-auto flex-1 text-sm"
        />
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
          Period start
          <input
            type="date"
            required
            value={periodStart}
            onChange={(event) => setPeriodStart(event.target.value)}
            className="input text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--muted)]">
          Period end
          <input
            type="date"
            required
            value={periodEnd}
            onChange={(event) => setPeriodEnd(event.target.value)}
            className="input text-sm"
          />
        </label>
        <button type="submit" disabled={loading} className="btn btn-primary">
          Record payment
        </button>
      </form>
    </section>
  );
}
