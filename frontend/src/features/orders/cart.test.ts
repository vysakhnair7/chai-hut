import { describe, expect, it } from "vitest";
import {
  addToCart,
  cartItems,
  cartUnits,
  estimateSubtotalPaise,
  MAX_LINE_QUANTITY,
  paiseToMoneyString,
  removeFromCart,
  setQuantity,
} from "./cart";

const products = [
  { id: "chai", mrp: "20.00" },
  { id: "samosa", mrp: "15.50" },
];

describe("cart", () => {
  it("adds items and increments quantities", () => {
    let cart = addToCart({}, "chai");
    cart = addToCart(cart, "chai");
    cart = addToCart(cart, "samosa");
    expect(cart).toEqual({ chai: 2, samosa: 1 });
    expect(cartUnits(cart)).toBe(3);
  });

  it("does not exceed the available stock", () => {
    let cart = {};
    for (let i = 0; i < 5; i++) cart = addToCart(cart, "chai", 3);
    expect(cart).toEqual({ chai: 3 });
  });

  it("does not exceed the backend's per-line limit", () => {
    expect(setQuantity({}, "chai", 500)).toEqual({ chai: MAX_LINE_QUANTITY });
  });

  it("removes a line when the quantity reaches zero", () => {
    expect(setQuantity({ chai: 1 }, "chai", 0)).toEqual({});
    expect(removeFromCart({ chai: 2, samosa: 1 }, "chai")).toEqual({ samosa: 1 });
  });

  it("builds the API payload", () => {
    expect(cartItems({ chai: 2 })).toEqual([{ product_id: "chai", quantity: 2 }]);
  });

  it("does not mutate the previous cart", () => {
    const before = { chai: 1 };
    addToCart(before, "chai");
    expect(before).toEqual({ chai: 1 });
  });
});

describe("estimate", () => {
  it("multiplies in whole paise without float drift", () => {
    const paise = estimateSubtotalPaise({ chai: 3, samosa: 3 }, products);
    expect(paise).toBe(3 * 2000 + 3 * 1550);
    expect(paiseToMoneyString(paise)).toBe("106.50");
  });
  it("ignores products that are no longer on the menu", () => {
    expect(estimateSubtotalPaise({ ghost: 2 }, products)).toBe(0);
  });
});
