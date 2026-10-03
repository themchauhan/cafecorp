'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { type ActionResult, runAction } from '@/lib/action-result';
import { logPlatformAudit } from '@/lib/auth/audit';
import { getSessionProfile, requireRole } from '@/lib/auth/session';

async function requireSuperAdmin() {
  return requireRole(await getSessionProfile(), ['SUPER_ADMIN']);
}

const createTenantSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  plan: z.enum(['TRIAL', 'PAID']),
});

export async function createTenant(input: {
  name: string;
  phone: string;
  email: string;
  plan: 'TRIAL' | 'PAID';
}): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const profile = await requireSuperAdmin();
    const { name, phone, email, plan } = createTenantSchema.parse(input);

    const trialEndsAt =
      plan === 'TRIAL'
        ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const ref = await adminDb.collection('tenants').add({
      name,
      phone,
      email,
      status: 'ACTIVE',
      plan,
      trialEndsAt,
      subscriptionEndsAt: null,
    });

    await logPlatformAudit(
      profile,
      'TENANT_CREATED',
      ref.id,
      'tenant',
      ref.id,
      { name, plan },
    );
    revalidatePath('/super-admin');
    return { id: ref.id };
  });
}

const inviteAdminSchema = z.object({
  tenantId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
});

/**
 * The missing half of Phase 1c's own acceptance criteria ("SUPER_ADMIN
 * creates the tenant, an admin is invited") — Phase 1c only covered an
 * existing ADMIN inviting STAFF, not a brand-new tenant's first ADMIN.
 */
export async function inviteTenantAdmin(input: {
  tenantId: string;
  email: string;
  name: string;
}): Promise<ActionResult<{ resetLink: string }>> {
  return runAction(async () => {
    const profile = await requireSuperAdmin();
    const { tenantId, email, name } = inviteAdminSchema.parse(input);

    const tenantSnap = await adminDb.doc(`tenants/${tenantId}`).get();
    if (!tenantSnap.exists) throw new Error('No such tenant');

    let uid: string;
    try {
      uid = (await adminAuth.getUserByEmail(email)).uid;
    } catch (error) {
      if ((error as { code?: string }).code !== 'auth/user-not-found')
        throw error;
      uid = (
        await adminAuth.createUser({
          email,
          password: crypto.randomBytes(24).toString('base64url'),
          displayName: name,
          emailVerified: false,
        })
      ).uid;
    }

    await adminAuth.setCustomUserClaims(uid, { role: 'ADMIN', tenantId });
    await adminDb
      .doc(`tenants/${tenantId}/profiles/${uid}`)
      .set({ name, role: 'ADMIN', status: 'ACTIVE' });

    // No email provider is configured for this MVP — same pattern as
    // Phase 1c's inviteStaff.
    const resetLink = await adminAuth.generatePasswordResetLink(email);

    await logPlatformAudit(
      profile,
      'TENANT_ADMIN_INVITED',
      tenantId,
      'profile',
      uid,
      { email },
    );
    revalidatePath(`/super-admin/${tenantId}`);
    return { resetLink };
  });
}

const setStatusSchema = z.object({
  tenantId: z.string().min(1),
  status: z.enum(['ACTIVE', 'SUSPENDED']),
});

export async function setTenantStatus(input: {
  tenantId: string;
  status: 'ACTIVE' | 'SUSPENDED';
}): Promise<ActionResult> {
  return runAction(async () => {
    const profile = await requireSuperAdmin();
    const { tenantId, status } = setStatusSchema.parse(input);

    const ref = adminDb.doc(`tenants/${tenantId}`);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('No such tenant');

    await ref.update({ status });
    await logPlatformAudit(
      profile,
      status === 'ACTIVE' ? 'TENANT_ACTIVATED' : 'TENANT_SUSPENDED',
      tenantId,
      'tenant',
      tenantId,
      {},
    );
    revalidatePath('/super-admin');
    revalidatePath(`/super-admin/${tenantId}`);
  });
}

const changePlanSchema = z.object({
  tenantId: z.string().min(1),
  plan: z.enum(['TRIAL', 'PAID']),
});

export async function changeTenantPlan(input: {
  tenantId: string;
  plan: 'TRIAL' | 'PAID';
}): Promise<ActionResult> {
  return runAction(async () => {
    const profile = await requireSuperAdmin();
    const { tenantId, plan } = changePlanSchema.parse(input);

    const ref = adminDb.doc(`tenants/${tenantId}`);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('No such tenant');

    await ref.update({ plan });
    await logPlatformAudit(
      profile,
      'TENANT_PLAN_CHANGED',
      tenantId,
      'tenant',
      tenantId,
      { plan },
    );
    revalidatePath(`/super-admin/${tenantId}`);
  });
}

const setExpirySchema = z.object({
  tenantId: z.string().min(1),
  trialEndsAt: z.string().optional(),
  subscriptionEndsAt: z.string().optional(),
});

/** Manual expiry adjustment (e.g. a goodwill extension) with no payment record. */
export async function setTenantExpiry(input: {
  tenantId: string;
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
}): Promise<ActionResult> {
  return runAction(async () => {
    const profile = await requireSuperAdmin();
    const { tenantId, trialEndsAt, subscriptionEndsAt } =
      setExpirySchema.parse(input);
    if (!trialEndsAt && !subscriptionEndsAt) {
      throw new Error('Provide a trial or subscription end date');
    }

    const ref = adminDb.doc(`tenants/${tenantId}`);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('No such tenant');

    const update: Record<string, string> = {};
    if (trialEndsAt) update.trialEndsAt = new Date(trialEndsAt).toISOString();
    if (subscriptionEndsAt) {
      update.subscriptionEndsAt = new Date(subscriptionEndsAt).toISOString();
    }

    await ref.update(update);
    await logPlatformAudit(
      profile,
      'TENANT_EXPIRY_CHANGED',
      tenantId,
      'tenant',
      tenantId,
      update,
    );
    revalidatePath(`/super-admin/${tenantId}`);
  });
}

const recordPaymentSchema = z.object({
  tenantId: z.string().min(1),
  amount: z.number().positive(),
  paymentMethod: z.string().min(1),
  referenceNumber: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  notes: z.string().optional().default(''),
});

/**
 * Records an offline (UPI/bank) subscription payment and extends the
 * tenant's subscription through the paid period — recording a real
 * payment also converts a TRIAL tenant to PAID, since they're now a
 * paying customer.
 */
export async function recordSubscriptionPayment(input: {
  tenantId: string;
  amount: number;
  paymentMethod: string;
  referenceNumber: string;
  periodStart: string;
  periodEnd: string;
  notes?: string;
}): Promise<ActionResult> {
  return runAction(async () => {
    const profile = await requireSuperAdmin();
    const {
      tenantId,
      amount,
      paymentMethod,
      referenceNumber,
      periodStart,
      periodEnd,
      notes,
    } = recordPaymentSchema.parse(input);

    const tenantRef = adminDb.doc(`tenants/${tenantId}`);
    const snap = await tenantRef.get();
    if (!snap.exists) throw new Error('No such tenant');

    const subscriptionEndsAt = new Date(periodEnd).toISOString();
    const paymentRef = await adminDb.collection('subscriptionPayments').add({
      tenantId,
      amount,
      paymentDate: FieldValue.serverTimestamp(),
      paymentMethod,
      referenceNumber,
      periodStart: new Date(periodStart).toISOString(),
      periodEnd: subscriptionEndsAt,
      notes,
    });

    await tenantRef.update({ plan: 'PAID', subscriptionEndsAt });
    await logPlatformAudit(
      profile,
      'SUBSCRIPTION_PAYMENT_RECORDED',
      tenantId,
      'subscriptionPayment',
      paymentRef.id,
      { amount, paymentMethod, periodEnd: subscriptionEndsAt },
    );
    revalidatePath(`/super-admin/${tenantId}`);
  });
}
