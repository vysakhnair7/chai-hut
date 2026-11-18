import { Badge } from "@/components/ui/badge";
import {
  ACTIVE_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATE_LABELS,
  PAYMENT_STATUS_LABELS,
  PRODUCT_STATUS_LABELS,
} from "@/constants/labels";
import type { ActiveStatus } from "@/types/common";
import type { ProductStatus } from "@/types/catalog";
import type { OrderPaymentState, OrderStatus, PaymentStatus } from "@/types/order";

type Tone = "neutral" | "brand" | "caramel" | "success" | "danger" | "warning";

const ORDER_TONE: Record<OrderStatus, Tone> = {
  placed: "caramel",
  preparing: "warning",
  ready: "success",
  completed: "neutral",
  cancelled: "danger",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_TONE[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

const PAYMENT_STATE_TONE: Record<OrderPaymentState, Tone> = {
  unpaid: "danger",
  partial: "warning",
  paid: "success",
};

export function PaymentStateBadge({ state }: { state: OrderPaymentState }) {
  return <Badge tone={PAYMENT_STATE_TONE[state]}>{PAYMENT_STATE_LABELS[state]}</Badge>;
}

const PAYMENT_STATUS_TONE: Record<PaymentStatus, Tone> = {
  pending: "warning",
  success: "success",
  failed: "danger",
  refunded: "neutral",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={PAYMENT_STATUS_TONE[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}

const PRODUCT_TONE: Record<ProductStatus, Tone> = {
  available: "success",
  out_of_stock: "warning",
  discontinued: "neutral",
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return <Badge tone={PRODUCT_TONE[status]}>{PRODUCT_STATUS_LABELS[status]}</Badge>;
}

export function ActiveBadge({ status }: { status: ActiveStatus }) {
  return <Badge tone={status === "active" ? "success" : "neutral"}>{ACTIVE_STATUS_LABELS[status]}</Badge>;
}
