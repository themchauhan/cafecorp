'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { updateTaxRate } from './actions';

export function TaxRateForm({
  initialTaxRatePercent,
}: {
  initialTaxRatePercent: number;
}) {
  const router = useRouter();
  const [taxRatePercent, setTaxRatePercent] = useState(
    String(initialTaxRatePercent),
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    const result = await updateTaxRate({
      taxRatePercent: Number(taxRatePercent),
    });
    if (!result.ok) {
      setError(result.error);
    } else {
      setSaved(true);
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-3 p-4">
      <div>
        <label htmlFor="taxRatePercent" className="text-sm font-semibold">
          Tax rate (%)
        </label>
        <p className="text-sm text-[var(--muted)]">
          Applied to every bill&apos;s amount after any discount. New orders
          pick up this rate when they&apos;re created — changing it later never
          affects an order already in progress or already billed.
        </p>
      </div>
      <input
        id="taxRatePercent"
        type="number"
        required
        min="0"
        max="100"
        step="0.01"
        value={taxRatePercent}
        onChange={(event) => setTaxRatePercent(event.target.value)}
        className="input w-32"
      />
      {error && (
        <p className="text-sm text-[var(--color-danger-600)]">{error}</p>
      )}
      {saved && !error && (
        <p className="text-sm text-[var(--color-success-600)]">Saved.</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary self-start"
      >
        {loading ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
