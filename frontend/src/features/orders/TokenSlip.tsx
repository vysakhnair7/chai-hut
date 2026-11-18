import { formatDateTime } from "@/utils/format";

interface TokenSlipProps {
  token: string;
  /** Customer name, or the walk-in name, or null for an anonymous walk-in. */
  customerLabel: string | null;
  items: { product_name: string; quantity: number }[];
  createdAt?: string;
}

/**
 * The token slip. The `print-area` class is what index.css prints: everything else on the page is hidden.
 * It deliberately shows no prices, so it is safe to hand over the counter.
 */
export function TokenSlip({ token, customerLabel, items, createdAt }: TokenSlipProps) {
  return (
    <div className="print-area mx-auto w-full max-w-xs rounded-lg border bg-white p-5 text-center text-black shadow-sm" data-testid="token-slip">
      <p className="text-sm font-semibold tracking-wide">CHAI HUT</p>
      <p className="mt-3 text-xs uppercase tracking-widest text-neutral-600">Your token</p>
      <p className="my-1 text-6xl font-extrabold leading-none tabular-nums" aria-label={`Token ${token}`}>
        {token}
      </p>
      {customerLabel && <p className="mt-3 text-sm font-medium">{customerLabel}</p>}
      {createdAt && <p className="text-xs text-neutral-600">{formatDateTime(createdAt)}</p>}
      <ul className="mt-4 space-y-1 border-t border-dashed border-neutral-400 pt-3 text-left text-sm">
        {items.map((i) => (
          <li key={i.product_name} className="flex justify-between gap-3">
            <span>{i.product_name}</span>
            <span className="tabular-nums">× {i.quantity}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-neutral-600">Please show this token when collecting your order.</p>
    </div>
  );
}
