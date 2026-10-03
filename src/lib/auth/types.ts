export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'STAFF';

export type SessionProfile = {
  uid: string;
  role: Role;
  /** null only for SUPER_ADMIN, which is not scoped to a tenant. */
  tenantId: string | null;
};
