import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { FormDialog } from "@/components/common/FormDialog";
import { FormField } from "@/components/common/FormField";
import { Input, Select } from "@/components/ui/input";
import type { OutstandingCustomer } from "@/types/finance";
import { getErrorMessage } from "@/utils/errors";
import { applyServerFieldErrors } from "@/utils/forms";
import { formatMoney } from "@/utils/format";
import { newIdempotencyKey } from "@/utils/ids";
import { useSettle } from "./hooks";
import { settlementSchema, type SettlementValues } from "./schemas";

interface Props {
  customer: OutstandingCustomer | null;
  onClose: () => void;
}

/** Month-end settlement of a customer's corporate dues. Same one-key-per-attempt rule as payments. */
export function SettleDialog({ customer, onClose }: Props) {
  const open = customer !== null;
  const [formError, setFormError] = useState<string | null>(null);
  const keyRef = useRef<string>(newIdempotencyKey());
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<SettlementValues>({
    resolver: zodResolver(settlementSchema),
    defaultValues: { method: "cash", amount: "", transaction_id: "", note: "" },
  });

  const method = watch("method");
  const signature = [method, watch("amount"), watch("transaction_id"), watch("note")].join("|");
  useEffect(() => {
    keyRef.current = newIdempotencyKey();
  }, [signature]);

  useEffect(() => {
    if (customer) {
      reset({ method: "cash", amount: "", transaction_id: "", note: "" });
      setFormError(null);
      keyRef.current = newIdempotencyKey();
    }
  }, [customer, reset]);

  const settle = useSettle(() => {
    keyRef.current = newIdempotencyKey();
    onClose();
  });

  const onSubmit = handleSubmit((v) => {
    if (!customer) return;
    setFormError(null);
    settle.mutate(
      {
        idempotencyKey: keyRef.current,
        body: {
          customer_id: customer.id,
          amount: v.amount,
          method: v.method,
          ...(v.transaction_id ? { transaction_id: v.transaction_id } : {}),
          ...(v.note ? { note: v.note } : {}),
        },
      },
      {
        onError: (e) => {
          if (!applyServerFieldErrors(e, setError, ["amount", "method", "transaction_id", "note"])) setFormError(getErrorMessage(e));
        },
      },
    );
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Settle dues: ${customer?.full_name ?? ""}`}
      description={customer ? `${customer.company_name} · currently owes ${formatMoney(customer.amount_due)}` : undefined}
      submitLabel="Record settlement"
      submitting={settle.isPending}
      onSubmit={onSubmit}
      error={formError}
    >
      <FormField label="Amount received (₹)" htmlFor="set-amount" error={errors.amount?.message}>
        <Input id="set-amount" inputMode="decimal" aria-invalid={!!errors.amount} {...register("amount")} />
      </FormField>
      <FormField label="Method" htmlFor="set-method" error={errors.method?.message}>
        <Select id="set-method" {...register("method")}>
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="card">Card</option>
        </Select>
      </FormField>
      {(method === "upi" || method === "card") && (
        <FormField label="Transaction reference" htmlFor="set-ref" error={errors.transaction_id?.message}>
          <Input id="set-ref" autoComplete="off" aria-invalid={!!errors.transaction_id} {...register("transaction_id")} />
        </FormField>
      )}
      <FormField label="Note (optional)" htmlFor="set-note" error={errors.note?.message}>
        <Input id="set-note" {...register("note")} />
      </FormField>
    </FormDialog>
  );
}
