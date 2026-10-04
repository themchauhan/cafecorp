import type { OrderStatus } from '@/app/orders/types';

const STATUS_CLASS: Record<OrderStatus, string> = {
  OPEN: 'badge badge-open',
  KOT_SENT: 'badge badge-kot',
  SERVED: 'badge badge-served',
  BILLED: 'badge badge-billed',
  CANCELLED: 'badge badge-cancelled',
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  OPEN: 'Open',
  KOT_SENT: 'In kitchen',
  SERVED: 'Served',
  BILLED: 'Billed',
  CANCELLED: 'Cancelled',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={STATUS_CLASS[status]}>{STATUS_LABEL[status]}</span>;
}
