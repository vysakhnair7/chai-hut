import type { Product } from "@/types/catalog";

/** productId -> quantity. A plain object keeps the cart trivially serialisable and testable. */
export type Cart = Record<string, number>;

/** Mirrors the backend's per-line limit (1–100). The backend remains the authority. */
export const MAX_LINE_QUANTITY = 100;

export function addToCart(cart: Cart, productId: string, max: number = MAX_LINE_QUANTITY): Cart {
  const limit = Math.min(max, MAX_LINE_QUANTITY);
  const current = cart[productId] ?? 0;
  if (current >= limit) return cart;
  return { ...cart, [productId]: current + 1 };
}

export function setQuantity(cart: Cart, productId: string, quantity: number, max: number = MAX_LINE_QUANTITY): Cart {
  const limit = Math.min(max, MAX_LINE_QUANTITY);
  const next = Math.min(Math.floor(quantity), limit);
  if (!Number.isFinite(next) || next <= 0) {
    const rest = { ...cart };
    delete rest[productId];
    return rest;
  }
  return { ...cart, [productId]: next };
}

export function removeFromCart(cart: Cart, productId: string): Cart {
  return setQuantity(cart, productId, 0);
}

export function cartItems(cart: Cart): { product_id: string; quantity: number }[] {
  return Object.entries(cart).map(([product_id, quantity]) => ({ product_id, quantity }));
}

export function cartUnits(cart: Cart): number {
  return Object.values(cart).reduce((sum, q) => sum + q, 0);
}

/**
 * Quantity × unit-price ESTIMATE shown while building an order, in whole paise to avoid float drift.
 * It excludes GST and discounts on purpose: the real totals are calculated by the backend and shown after submit.
 */
export function estimateSubtotalPaise(cart: Cart, products: Pick<Product, "id" | "mrp">[]): number {
  const byId = new Map(products.map((p) => [p.id, p]));
  let paise = 0;
  for (const [id, qty] of Object.entries(cart)) {
    const product = byId.get(id);
    if (!product) continue;
    paise += Math.round(Number(product.mrp) * 100) * qty;
  }
  return paise;
}

export function paiseToMoneyString(paise: number): string {
  return (paise / 100).toFixed(2);
}
