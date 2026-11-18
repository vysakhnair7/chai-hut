import { screen, waitFor } from "@testing-library/react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { paymentService } from "@/services/paymentService";
import { QueryWrapper } from "@/test/utils";
import { ApiError } from "@/utils/errors";
import { RecordPaymentDialog } from "./RecordPaymentDialog";

function renderDialog(props: Partial<{ hasCustomer: boolean }> = {}) {
  return render(
    <QueryWrapper>
      <RecordPaymentDialog open onOpenChange={() => undefined} orderId="order-1" orderToken="17" balanceDue="42.00" hasCustomer={props.hasCustomer ?? true} />
    </QueryWrapper>,
  );
}

const paymentOk = { id: "p1", order_id: "order-1", amount: "42.00", method: "cash", status: "success", transaction_id: null, received_by: "u", created_at: "2026-11-18T05:00:00Z" } as const;

describe("RecordPaymentDialog", () => {
  it("shows the balance due and defaults to paying it in full", async () => {
    renderDialog();
    expect(await screen.findByText(/Balance due: ₹42\.00/)).toBeInTheDocument();
    expect(screen.getByText("Leave blank to pay the full balance")).toBeInTheDocument();
  });

  it("records a cash payment with an idempotency key", async () => {
    const record = vi.spyOn(paymentService, "record").mockResolvedValue({ ...paymentOk });
    renderDialog();
    await userEvent.setup().click(await screen.findByRole("button", { name: "Record payment" }));
    await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    const [orderId, body, key] = record.mock.calls[0] ?? [];
    expect(orderId).toBe("order-1");
    expect(body).toEqual({ method: "cash" });
    expect(typeof key).toBe("string");
    expect((key as string).length).toBeGreaterThan(8);
  });

  it("requires a transaction reference for UPI and does not call the API without one", async () => {
    const record = vi.spyOn(paymentService, "record");
    renderDialog();
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByLabelText("Method"), "upi");
    await user.click(screen.getByRole("button", { name: "Record payment" }));
    expect(await screen.findByText("A transaction reference is required for UPI and card")).toBeInTheDocument();
    expect(record).not.toHaveBeenCalled();
  });

  it("rejects an amount of zero", async () => {
    const record = vi.spyOn(paymentService, "record");
    renderDialog();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Amount (₹)"), "0");
    await user.click(screen.getByRole("button", { name: "Record payment" }));
    expect(await screen.findByText("Amount must be greater than zero")).toBeInTheDocument();
    expect(record).not.toHaveBeenCalled();
  });

  it("reuses the same idempotency key when the same request is retried after a failure", async () => {
    const record = vi
      .spyOn(paymentService, "record")
      .mockRejectedValueOnce(new ApiError(0, "network_error", "Cannot reach the Chai Hut server."))
      .mockResolvedValueOnce({ ...paymentOk });
    renderDialog();
    const user = userEvent.setup();
    const submit = await screen.findByRole("button", { name: "Record payment" });
    await user.click(submit);
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot reach");
    await user.click(screen.getByRole("button", { name: "Record payment" }));
    await waitFor(() => expect(record).toHaveBeenCalledTimes(2));
    expect(record.mock.calls[1]?.[2]).toBe(record.mock.calls[0]?.[2]);
  });

  it("uses a new idempotency key once the user changes the payment", async () => {
    const record = vi
      .spyOn(paymentService, "record")
      .mockRejectedValueOnce(new ApiError(409, "conflict", "Amount exceeds the balance"))
      .mockResolvedValueOnce({ ...paymentOk });
    renderDialog();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Amount (₹)"), "999");
    await user.click(screen.getByRole("button", { name: "Record payment" }));
    await screen.findByRole("alert");
    await user.clear(screen.getByLabelText("Amount (₹)"));
    await user.type(screen.getByLabelText("Amount (₹)"), "42");
    await user.click(screen.getByRole("button", { name: "Record payment" }));
    await waitFor(() => expect(record).toHaveBeenCalledTimes(2));
    expect(record.mock.calls[1]?.[2]).not.toBe(record.mock.calls[0]?.[2]);
  });

  it("offers corporate credit only for orders that belong to a registered customer", async () => {
    const { unmount } = renderDialog({ hasCustomer: true });
    expect(await screen.findByRole("option", { name: "Corporate credit" })).toBeInTheDocument();
    unmount();
    renderDialog({ hasCustomer: false });
    await screen.findByLabelText("Method");
    expect(screen.queryByRole("option", { name: "Corporate credit" })).not.toBeInTheDocument();
  });

  it("explains that credit is not cash collected", async () => {
    renderDialog();
    await userEvent.setup().selectOptions(await screen.findByLabelText("Method"), "corporate_credit");
    expect(screen.getByText(/not counted as cash collected/)).toBeInTheDocument();
  });
});
