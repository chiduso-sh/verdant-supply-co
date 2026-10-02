import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOrderItems,
  collapseCartLines,
  computeSubtotalCents,
  formatShippingAddress,
  validateShipping,
  type PricedProduct,
  type ShippingInput,
} from "../lib/checkout";

const VALID: ShippingInput = {
  fullName: "Ada Lovelace",
  line1: "12 Analytical Way",
  line2: "Flat 3",
  city: "London",
  state: "Greater London",
  postalCode: "NW1 4RX",
  country: "United Kingdom",
  phone: "+44 20 7946 0958",
};

describe("validateShipping", () => {
  it("accepts a complete address", () => {
    const result = validateShipping(VALID);
    assert.equal(result.ok, true);
  });

  it("normalizes into database column names", () => {
    const result = validateShipping(VALID);
    assert.ok(result.ok);
    assert.deepEqual(result.value, {
      shippingFullName: "Ada Lovelace",
      shippingLine1: "12 Analytical Way",
      shippingLine2: "Flat 3",
      shippingCity: "London",
      shippingState: "Greater London",
      shippingPostalCode: "NW1 4RX",
      shippingCountry: "United Kingdom",
      shippingPhone: "+44 20 7946 0958",
    });
  });

  it("trims surrounding whitespace on every field", () => {
    const result = validateShipping({
      ...VALID,
      fullName: "  Ada Lovelace  ",
      city: "\tLondon\n",
    });
    assert.ok(result.ok);
    assert.equal(result.value.shippingFullName, "Ada Lovelace");
    assert.equal(result.value.shippingCity, "London");
  });

  it("collapses empty optional fields to null, not empty strings", () => {
    const result = validateShipping({ ...VALID, line2: "   ", phone: "" });
    assert.ok(result.ok);
    assert.equal(result.value.shippingLine2, null);
    assert.equal(result.value.shippingPhone, null);
  });

  const required: Array<[keyof ShippingInput, string]> = [
    ["fullName", "Full name is required."],
    ["line1", "Address is required."],
    ["city", "City is required."],
    ["state", "State or region is required."],
    ["postalCode", "Postal code is required."],
    ["country", "Country is required."],
  ];

  for (const [field, message] of required) {
    it(`rejects a missing ${field}`, () => {
      const result = validateShipping({ ...VALID, [field]: "" });
      assert.deepEqual(result, { ok: false, error: message });
    });

    it(`rejects a whitespace-only ${field}`, () => {
      const result = validateShipping({ ...VALID, [field]: "   " });
      assert.equal(result.ok, false);
    });
  }

  it("reports the first missing field, so the user fixes them top-down", () => {
    const result = validateShipping({ ...VALID, city: "", fullName: "" });
    assert.deepEqual(result, { ok: false, error: "Full name is required." });
  });
});

describe("collapseCartLines", () => {
  it("maps productId to quantity", () => {
    const result = collapseCartLines([
      { productId: 1, quantity: 2 },
      { productId: 10, quantity: 1 },
    ]);
    assert.ok(result.ok);
    assert.deepEqual([...result.value.entries()], [
      [1, 2],
      [10, 1],
    ]);
  });

  it("sums duplicate lines for the same product", () => {
    const result = collapseCartLines([
      { productId: 1, quantity: 2 },
      { productId: 1, quantity: 3 },
    ]);
    assert.ok(result.ok);
    assert.equal(result.value.get(1), 5);
  });

  it("caps a summed duplicate at 99", () => {
    const result = collapseCartLines([
      { productId: 1, quantity: 90 },
      { productId: 1, quantity: 90 },
    ]);
    assert.ok(result.ok);
    assert.equal(result.value.get(1), 99);
  });

  it("rejects an empty cart", () => {
    assert.deepEqual(collapseCartLines([]), {
      ok: false,
      error: "Your cart is empty.",
    });
  });

  it("rejects a zero quantity", () => {
    const result = collapseCartLines([{ productId: 1, quantity: 0 }]);
    assert.deepEqual(result, {
      ok: false,
      error: "Quantities must be between 1 and 99.",
    });
  });

  it("rejects a negative quantity", () => {
    assert.equal(
      collapseCartLines([{ productId: 1, quantity: -4 }]).ok,
      false,
    );
  });

  it("rejects a quantity above 99 rather than silently clamping it", () => {
    assert.equal(
      collapseCartLines([{ productId: 1, quantity: 100 }]).ok,
      false,
    );
  });

  it("rejects a fractional quantity", () => {
    const result = collapseCartLines([{ productId: 1, quantity: 1.5 }]);
    assert.deepEqual(result, {
      ok: false,
      error: "That cart looks malformed. Try again.",
    });
  });

  it("rejects a non-integer product id", () => {
    assert.equal(
      collapseCartLines([{ productId: 1.2, quantity: 1 }]).ok,
      false,
    );
  });

  it("rejects NaN and Infinity", () => {
    assert.equal(
      collapseCartLines([{ productId: Number.NaN, quantity: 1 }]).ok,
      false,
    );
    assert.equal(
      collapseCartLines([{ productId: 1, quantity: Number.POSITIVE_INFINITY }])
        .ok,
      false,
    );
  });

  it("rejects a string quantity smuggled past the types", () => {
    const hostile = [{ productId: 1, quantity: "5" }] as unknown as Array<{
      productId: number;
      quantity: number;
    }>;
    assert.equal(collapseCartLines(hostile).ok, false);
  });
});

describe("buildOrderItems", () => {
  const products: PricedProduct[] = [
    { id: 1, name: "Monstera Deliciosa", priceCents: 4800 },
    { id: 10, name: "Brass Plant Mister", priceCents: 3400 },
  ];

  it("snapshots the name and price from the database row", () => {
    const wanted = new Map([
      [1, 2],
      [10, 1],
    ]);
    const result = buildOrderItems(products, wanted);
    assert.ok(result.ok);
    assert.deepEqual(result.value, [
      {
        productId: 1,
        nameSnapshot: "Monstera Deliciosa",
        unitPriceCents: 4800,
        quantity: 2,
      },
      {
        productId: 10,
        nameSnapshot: "Brass Plant Mister",
        unitPriceCents: 3400,
        quantity: 1,
      },
    ]);
  });

  it("takes ONLY the quantity from the client", () => {
    // The whole point of the design: a tampered cart cannot set a price,
    // because no price ever reaches this function from the client.
    const wanted = new Map([[1, 1]]);
    const result = buildOrderItems([products[0]], wanted);
    assert.ok(result.ok);
    assert.equal(result.value[0].unitPriceCents, 4800);
  });

  it("rejects when a requested product was not found in the database", () => {
    const wanted = new Map([
      [1, 1],
      [999, 1],
    ]);
    const result = buildOrderItems([products[0]], wanted);
    assert.deepEqual(result, {
      ok: false,
      error: "One of those products no longer exists. Please review your cart.",
    });
  });

  it("rejects when the database returns a product nobody asked for", () => {
    const result = buildOrderItems(products, new Map([[1, 1]]));
    assert.equal(result.ok, false);
  });

  it("handles a single-item order", () => {
    const result = buildOrderItems([products[1]], new Map([[10, 3]]));
    assert.ok(result.ok);
    assert.equal(result.value.length, 1);
    assert.equal(result.value[0].quantity, 3);
  });
});

describe("computeSubtotalCents", () => {
  it("sums unit price times quantity", () => {
    const total = computeSubtotalCents([
      { productId: 1, nameSnapshot: "a", unitPriceCents: 4800, quantity: 2 },
      { productId: 2, nameSnapshot: "b", unitPriceCents: 3400, quantity: 1 },
    ]);
    assert.equal(total, 13_000);
  });

  it("is zero for no items", () => {
    assert.equal(computeSubtotalCents([]), 0);
  });

  it("stays an exact integer at awkward prices", () => {
    const total = computeSubtotalCents([
      { productId: 1, nameSnapshot: "a", unitPriceCents: 1999, quantity: 3 },
      { productId: 2, nameSnapshot: "b", unitPriceCents: 333, quantity: 7 },
    ]);
    assert.equal(total, 1999 * 3 + 333 * 7);
    assert.ok(Number.isInteger(total));
  });
});

describe("formatShippingAddress", () => {
  it("renders the full address as display lines", () => {
    assert.deepEqual(formatShippingAddress(VALID), [
      "Ada Lovelace",
      "12 Analytical Way",
      "Flat 3",
      "London, Greater London NW1 4RX",
      "United Kingdom",
    ]);
  });

  it("omits an empty second address line", () => {
    const lines = formatShippingAddress({ ...VALID, line2: "" });
    assert.equal(lines.length, 4);
    assert.ok(!lines.includes("Flat 3"));
  });

  it("does not include the phone number in the mailing address", () => {
    const lines = formatShippingAddress(VALID);
    assert.ok(!lines.some((line) => line.includes("7946")));
  });
});
