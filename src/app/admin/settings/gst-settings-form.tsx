'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { DEFAULT_SAC_CODE } from '@/lib/gst';
import { updateGstSettings } from './actions';

export function GstSettingsForm({
  initialGstEnabled,
  initialGstin,
  initialGstLegalName,
  initialGstAddress,
  initialGstSacCode,
}: {
  initialGstEnabled: boolean;
  initialGstin: string;
  initialGstLegalName: string;
  initialGstAddress: string;
  initialGstSacCode: string;
}) {
  const router = useRouter();
  const [gstEnabled, setGstEnabled] = useState(initialGstEnabled);
  const [gstin, setGstin] = useState(initialGstin);
  const [gstLegalName, setGstLegalName] = useState(initialGstLegalName);
  const [gstAddress, setGstAddress] = useState(initialGstAddress);
  const [gstSacCode, setGstSacCode] = useState(
    initialGstSacCode || DEFAULT_SAC_CODE,
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    const result = await updateGstSettings({
      gstEnabled,
      gstin,
      gstLegalName,
      gstAddress,
      gstSacCode,
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
        <h2 className="text-sm font-semibold">GST tax invoices</h2>
        <p className="text-sm text-[var(--muted)]">
          When on, every billed order gets a proper Tax Invoice — GSTIN, a
          serial invoice number, and a CGST+SGST breakup — using the tax rate
          set above as the GST rate. New orders pick up these details when
          they&apos;re created, so a later change here never rewrites a past
          invoice.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={gstEnabled}
          onChange={(event) => setGstEnabled(event.target.checked)}
          className="h-5 w-5"
        />
        Issue GST tax invoices
      </label>

      {gstEnabled && (
        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-3">
          <div>
            <label htmlFor="gstin" className="text-sm font-semibold">
              GSTIN
            </label>
            <input
              id="gstin"
              type="text"
              required
              maxLength={15}
              placeholder="09AAACH7409R1ZZ"
              value={gstin}
              onChange={(event) => setGstin(event.target.value.toUpperCase())}
              className="input mt-1 uppercase"
            />
          </div>
          <div>
            <label htmlFor="gstLegalName" className="text-sm font-semibold">
              Registered business name
            </label>
            <input
              id="gstLegalName"
              type="text"
              required
              value={gstLegalName}
              onChange={(event) => setGstLegalName(event.target.value)}
              className="input mt-1"
            />
          </div>
          <div>
            <label htmlFor="gstAddress" className="text-sm font-semibold">
              Registered address
            </label>
            <input
              id="gstAddress"
              type="text"
              required
              value={gstAddress}
              onChange={(event) => setGstAddress(event.target.value)}
              className="input mt-1"
            />
          </div>
          <div>
            <label htmlFor="gstSacCode" className="text-sm font-semibold">
              SAC code
            </label>
            <p className="text-xs text-[var(--muted)]">
              Default (996331) covers restaurant/cafe/eating-facility services —
              the right code for almost every cafeteria.
            </p>
            <input
              id="gstSacCode"
              type="text"
              required
              value={gstSacCode}
              onChange={(event) => setGstSacCode(event.target.value)}
              className="input mt-1 w-40"
            />
          </div>
        </div>
      )}

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
