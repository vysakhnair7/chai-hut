"""Decimal money helpers and order total calculation (pure functions, no DB)."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Sequence

TWO_PLACES = Decimal("0.01")
ZERO = Decimal("0.00")


def q(value: Decimal | int | str) -> Decimal:
    """Quantize to 2 decimal places (paise), half-up."""
    return Decimal(value).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class Line:
    unit_price: Decimal
    quantity: int
    gst_rate: Decimal  # percent, e.g. Decimal("5.00")

    @property
    def total(self) -> Decimal:
        return q(self.unit_price * self.quantity)


@dataclass(frozen=True)
class OrderTotals:
    subtotal: Decimal
    discount: Decimal
    cgst: Decimal
    sgst: Decimal
    tax: Decimal
    total: Decimal


def calculate_order_totals(lines: Sequence[Line], discount: Decimal = ZERO) -> OrderTotals:
    """Prices are GST-exclusive. GST is charged on the discounted value and split
    equally into CGST and SGST. Guarantees: tax == cgst + sgst and
    total == subtotal - discount + tax, to the paisa.
    """
    if not lines:
        raise ValueError("an order needs at least one line")
    discount = q(discount)
    subtotal = sum((ln.total for ln in lines), ZERO)
    if discount < 0 or discount > subtotal:
        raise ValueError("discount must be between 0 and the subtotal")

    # Group by GST rate, then spread the discount across groups pro rata
    # (last group absorbs the rounding remainder so the shares add up exactly).
    groups: dict[Decimal, Decimal] = {}
    for ln in lines:
        groups[ln.gst_rate] = groups.get(ln.gst_rate, ZERO) + ln.total

    cgst_total = sgst_total = ZERO
    remaining_discount = discount
    items = list(groups.items())
    for idx, (rate, group_subtotal) in enumerate(items):
        if idx == len(items) - 1:
            share = remaining_discount
        else:
            share = q(discount * group_subtotal / subtotal) if subtotal else ZERO
            remaining_discount -= share
        taxable = group_subtotal - share
        tax = q(taxable * rate / Decimal(100))
        cgst = q(tax / 2)
        sgst = tax - cgst
        cgst_total += cgst
        sgst_total += sgst

    tax_total = cgst_total + sgst_total
    return OrderTotals(
        subtotal=subtotal,
        discount=discount,
        cgst=cgst_total,
        sgst=sgst_total,
        tax=tax_total,
        total=subtotal - discount + tax_total,
    )
