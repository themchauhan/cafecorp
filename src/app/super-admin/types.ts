export type Tenant = {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: 'ACTIVE' | 'SUSPENDED';
  plan: string;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
};

export type SubscriptionPayment = {
  id: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string;
  periodStart: string;
  periodEnd: string;
  notes: string;
};
