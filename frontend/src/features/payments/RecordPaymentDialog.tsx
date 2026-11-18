import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { FormDialog } from "@/components/common/FormDialog";
import { FormField } from "@/components/common/FormField";
import { Input, Select } from "@/components/ui/input";
import { PAYMENT_METHOD_LABELS } from "@/constants/labels";
import type { PaymentMethod } from "@/types/order";
import { getErrorMessage } from "@/utils/errors";
import { applyServerFieldErrors } from "@/utils/forms";
import { formatMoney } from "@/utils/format";
import { newIdempotencyKey } from "@/utils/ids";
import { useRecordPayment } from "./hooks";
import { paymentSchema, type PaymentValues } from "./schemas";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderToken: string;
  balanceDue: string;
  /** Corporate credit is only possible for orders that belong to a registered customer. */
  hasCustomer: boolean;
}

/**
 * Records one payment. One Idempotency-Key is created per attempt and reused when the same request is retried
 * (e.g. after a dropped connection), so the backend can never apply the same payment twice. Changing any field
 * starts a new attempt with a new key.
 */
export function RecordPaymentDialog({ open, onOpenChange, orderId, orderToken, balanceDue, hasCustomer }: Props) {
  const [formError, setFormError] = useState<string | null>(null);
  const keyRef = useRef<string>(newIdempotencyKey());
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { method: "cash", amount: "", transaction_id: "" },
  });

  const method = watch("method");
  const attemptSignature = [method, watch("amount"), watch("transaction_id")].join("|");
  useEffect(() => {
    keyRef.current = newIdempotencyKey();
  }, [attemptSignature]);

  useEffect(() => {
    if (open) {
      reset({ method: "cash", amount: "", transaction_id: "" });
      setFormError(null);
      keyRef.current = newIdempotencyKey();
    }
  }, [open, reset]);

  const record = useRecordPayment(orderId, () => {
    keyRef.current = newIdempotencyKey();
    onOpenChange(false);
  });

  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    record.mutate(
      {
        idempotencyKey: keyRef.current,
        body: {
          method: v.method,
          ...(v.amount ? { amount: v.amount } : {}),
          ...(v.transaction_id ? { transaction_id: v.transaction_id } : {}),
        },
      },
      {
        onError: (e) => {
          if (!applyServerFieldErrors(e, setError, ["method", "amount", "transaction_id"])) setFormError(getErrorMessage(e));
        },
      },
    );
  });

  const methods: PaymentMethod[] = hasCustomer ? ["cash", "upi", "card", "corporate_credit"] : ["cash", "upi", "card"];

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Record payment · ${orderToken}`}
      description={`Balance due: ${formatMoney(balanceDue)}`}
      submitLabel="Record payment"
      submitting={record.isPending}
      onSubmit={onSubmit}
      error={formError}
    >
      <FormField label="Method" htmlFor="pay-method" error={errors.method?.message}>
        <Select id="pay-method" {...register("method")}>
          {methods.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </Select>
      </FormField>
      {method === "corporate_credit" && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">
          This adds to the customer&apos;s corporate dues. It is not counted as cash collected until they settle.
        </p>
      )}
      <FormField label="Amount (₹)" htmlFor="pay-amount" error={errors.amount?.message} hint="Leave blank to pay the full balance">
        <Input id="pay-amount" inputMode="decimal" aria-invalid={!!errors.amount} {...register("amount")} />
      </FormField>
      {(method === "upi" || method === "card") && (
        <FormField label="Transaction reference" htmlFor="pay-ref" error={errors.transaction_id?.message}>
          <Input id="pay-ref" autoComplete="off" aria-invalid={!!errors.transaction_id} {...register("transaction_id")} />
        </FormField>
      )}
    </FormDialog>
  );
}
