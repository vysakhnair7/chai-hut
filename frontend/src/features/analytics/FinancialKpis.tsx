import { Banknote, CreditCard, HandCoins, Receipt, ShoppingBag, TrendingUp, Wallet } from "lucide-react";
import { StatCard } from "@/components/common/StatCard";
import type { FinancialSummary } from "@/types/finance";
import { formatMoney } from "@/utils/format";

/**
 * Every number here comes from the backend's financial report. Two rules the UI keeps:
 *  - "Collected" is cash/UPI/card actually received. Corporate credit sales are shown separately and never added to it.
 *  - Profit is null when any sold item has no cost price. Then we show a dash and say why, never a made-up zero.
 */
export function FinancialKpis({ summary, settlementsReceived }: { summary: FinancialSummary; settlementsReceived?: string }) {
  const costHint = summary.cost_data_complete
    ? undefined
    : `Cost price missing for ${summary.items_missing_cost} sold item${summary.items_missing_cost === 1 ? "" : "s"}. Add it in Products to see profit.`;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Orders" value={String(summary.order_count)} icon={ShoppingBag} to="/orders" />
      <StatCard label="Net sales" value={formatMoney(summary.net_sales)} hint={`Billed incl. tax ${formatMoney(summary.billed_total)}`} icon={Receipt} to="/orders" />
      <StatCard label="Collected" value={formatMoney(summary.total_collected)} hint="Cash, UPI and card received" icon={Banknote} tone="success" to="/payments" />
      <StatCard label="Sold on credit" value={formatMoney(summary.corporate_credit_sales)} hint="Not collected yet" icon={CreditCard} to="/dues" />
      <StatCard label="Outstanding receivable" value={formatMoney(summary.outstanding_receivable)} hint="All corporate dues today" icon={Wallet} tone="warning" to="/dues" />
      {settlementsReceived !== undefined && (
        <StatCard label="Credit settlements received" value={formatMoney(settlementsReceived)} icon={HandCoins} to="/dues" />
      )}
      <StatCard label="Expenses" value={formatMoney(summary.expenses)} icon={Wallet} to="/expenses" />
      <StatCard
        label="Gross profit"
        value={summary.gross_profit === null ? "—" : formatMoney(summary.gross_profit)}
        hint={costHint ?? `Cost of goods ${formatMoney(summary.cogs)}`}
        icon={TrendingUp}
        tone={summary.gross_profit === null ? "default" : "success"}
        to={summary.cost_data_complete ? undefined : "/products"}
      />
      <StatCard
        label="Net profit"
        value={summary.net_profit === null ? "—" : formatMoney(summary.net_profit)}
        hint={costHint ?? "After expenses"}
        icon={TrendingUp}
        tone={summary.net_profit === null ? "default" : Number(summary.net_profit) < 0 ? "danger" : "success"}
        to={summary.cost_data_complete ? undefined : "/products"}
      />
    </div>
  );
}
