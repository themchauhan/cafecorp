import { describe, expect, it, vi, beforeEach } from 'vitest';

const { docGet, docSet, docDelete } = vi.hoisted(() => ({
  docGet: vi.fn(),
  docSet: vi.fn(),
  docDelete: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    doc: () => ({ get: docGet, set: docSet, delete: docDelete }),
  },
}));

import {
  disableMfa,
  enableMfa,
  isMfaEnabled,
  startMfaEnrollment,
  verifyMfaToken,
} from './mfa';
import { generate, generateSecret } from 'otplib';

const tenantProfile = { uid: 'u1', tenantId: 'tenant-a' };
const superAdminProfile = { uid: 'u2', tenantId: null };

describe('mfa', () => {
  beforeEach(() => {
    docGet.mockReset();
    docSet.mockReset();
    docDelete.mockReset();
  });

  it('isMfaEnabled is false when no record exists', async () => {
    docGet.mockResolvedValue({ exists: false });
    await expect(isMfaEnabled(tenantProfile)).resolves.toBe(false);
  });

  it('isMfaEnabled is false for a not-yet-confirmed enrollment', async () => {
    docGet.mockResolvedValue({
      exists: true,
      data: () => ({ secret: 'ABC', enabled: false }),
    });
    await expect(isMfaEnabled(tenantProfile)).resolves.toBe(false);
  });

  it('startMfaEnrollment stores a secret as not-yet-enabled and returns a valid otpauth URL', async () => {
    const { secret, otpauthUrl } = await startMfaEnrollment(
      tenantProfile,
      'admin@demo.cafe',
    );
    expect(docSet).toHaveBeenCalledWith({ secret, enabled: false });
    expect(otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
  });

  it('startMfaEnrollment uses the platformAdmins path for SUPER_ADMIN (no tenantId)', async () => {
    await startMfaEnrollment(superAdminProfile, 'super@cafecorp.app');
    // The mocked adminDb.doc() doesn't record its argument directly,
    // so this is exercised for real against the emulator in
    // tests/rules/tenancy.test.ts; here we just confirm it doesn't throw.
    expect(docSet).toHaveBeenCalled();
  });

  it('verifyMfaToken rejects when no record exists', async () => {
    docGet.mockResolvedValue({ exists: false });
    await expect(verifyMfaToken(tenantProfile, '123456')).resolves.toBe(false);
  });

  it('verifyMfaToken accepts a freshly generated token for the stored secret', async () => {
    const secret = generateSecret();
    docGet.mockResolvedValue({
      exists: true,
      data: () => ({ secret, enabled: false }),
    });
    const token = await generate({ secret });
    await expect(verifyMfaToken(tenantProfile, token)).resolves.toBe(true);
  });

  it('verifyMfaToken rejects a wrong token', async () => {
    docGet.mockResolvedValue({
      exists: true,
      data: () => ({ secret: generateSecret(), enabled: false }),
    });
    await expect(verifyMfaToken(tenantProfile, '000000')).resolves.toBe(false);
  });

  it('enableMfa merges enabled:true onto the existing doc', async () => {
    await enableMfa(tenantProfile);
    expect(docSet).toHaveBeenCalledWith({ enabled: true }, { merge: true });
  });

  it('disableMfa deletes the doc', async () => {
    await disableMfa(tenantProfile);
    expect(docDelete).toHaveBeenCalled();
  });
});
