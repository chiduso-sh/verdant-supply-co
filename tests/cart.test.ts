import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addLine,
  cartCount,
  cartSubtotalCents,
  MAX_QUANTITY,
  parseStoredCart,
  removeLine,
  setLineQuantity,
  type CartLine,
  type NewCartLine,
} from "../lib/cart";

const MONSTERA: NewCartLine = {
  productId: 1,
  slug: "monstera-deliciosa",
  name: "Monstera Deliciosa",
  priceCents: 4800,
  imageUrl: "https://picsum.photos/seed/monstera-deliciosa/800/800",
};

const MISTER: NewCartLine = {
  productId: 10,
  slug: "brass-mister",
  name: "Brass Plant Mister",
  priceCents: 3400,
  imageUrl: "https://picsum.photos/seed/brass-mister/800/800",
};

function line(base: NewCartLine, quantity: number): CartLine {
  return { ...base, quantity };
}

describe("addLine", () => {
  it("adds a new line with quantity 1 by default", () => {
    assert.deepEqual(addLine([], MONSTERA), [line(MONSTERA, 1)]);
  });

  it("adds a new line with an explicit quantity", () => {
    assert.deepEqual(addLine([], MONSTERA, 3), [line(MONSTERA, 3)]);
  });

  it("merges into an existing line instead of duplicating it", () => {
    const result = addLine([line(MONSTERA, 2)], MONSTERA, 3);
    assert.equal(result.length, 1);
    assert.equal(result[0].quantity, 5);
  });

  it("keeps distinct products separate", () => {
    const result = addLine([line(MONSTERA, 1)], MISTER, 2);
    assert.deepEqual(
      result.map((l) => [l.productId, l.quantity]),
      [
        [1, 1],
        [10, 2],
      ],
    );
  });

  it("caps a merge at MAX_QUANTITY", () => {
    const result = addLine([line(MONSTERA, 98)], MONSTERA, 50);
    assert.equal(result[0].quantity, MAX_QUANTITY);
  });

  it("clamps an absurd requested quantity", () => {
    assert.equal(addLine([], MONSTERA, 10_000)[0].quantity, MAX_QUANTITY);
  });

  it("treats a zero or negative quantity as 1 rather than creating a dead line", () => {
    assert.equal(addLine([], MONSTERA, 0)[0].quantity, 1);
    assert.equal(addLine([], MONSTERA, -5)[0].quantity, 1);
  });

  it("does not mutate the input array", () => {
    const original = [line(MONSTERA, 1)];
    addLine(original, MISTER, 1);
    assert.equal(original.length, 1);
  });
});

describe("setLineQuantity", () => {
  it("sets an absolute quantity", () => {
    const result = setLineQuantity([line(MONSTERA, 1)], 1, 7);
    assert.equal(result[0].quantity, 7);
  });

  it("removes the line at zero", () => {
    assert.deepEqual(setLineQuantity([line(MONSTERA, 4)], 1, 0), []);
  });

  it("removes the line at a negative quantity", () => {
    assert.deepEqual(setLineQuantity([line(MONSTERA, 4)], 1, -2), []);
  });

  it("caps at MAX_QUANTITY", () => {
    assert.equal(setLineQuantity([line(MONSTERA, 1)], 1, 500)[0].quantity, 99);
  });

  it("ignores NaN from an emptied number input", () => {
    // <input type="number"> yields NaN when cleared; the line should survive.
    assert.deepEqual(setLineQuantity([line(MONSTERA, 4)], 1, Number.NaN), []);
  });

  it("leaves other lines untouched", () => {
    const result = setLineQuantity([line(MONSTERA, 1), line(MISTER, 2)], 1, 9);
    assert.equal(result.find((l) => l.productId === 10)?.quantity, 2);
  });
});

describe("removeLine", () => {
  it("removes only the matching product", () => {
    const result = removeLine([line(MONSTERA, 1), line(MISTER, 2)], 1);
    assert.deepEqual(
      result.map((l) => l.productId),
      [10],
    );
  });

  it("is a no-op for an unknown product", () => {
    const lines = [line(MONSTERA, 1)];
    assert.deepEqual(removeLine(lines, 999), lines);
  });
});

describe("cartCount", () => {
  it("counts units, not lines", () => {
    assert.equal(cartCount([line(MONSTERA, 3), line(MISTER, 2)]), 5);
  });

  it("is zero for an empty cart", () => {
    assert.equal(cartCount([]), 0);
  });
});

describe("cartSubtotalCents", () => {
  it("multiplies price by quantity per line", () => {
    // 4800*2 + 3400*1
    assert.equal(cartSubtotalCents([line(MONSTERA, 2), line(MISTER, 1)]), 13_000);
  });

  it("is zero for an empty cart", () => {
    assert.equal(cartSubtotalCents([]), 0);
  });

  it("stays an integer", () => {
    const total = cartSubtotalCents([line(MONSTERA, 7), line(MISTER, 3)]);
    assert.ok(Number.isInteger(total));
  });
});

describe("parseStoredCart", () => {
  it("returns an empty cart for null", () => {
    assert.deepEqual(parseStoredCart(null), []);
  });

  it("returns an empty cart for an empty string", () => {
    assert.deepEqual(parseStoredCart(""), []);
  });

  it("returns an empty cart for malformed JSON instead of throwing", () => {
    assert.deepEqual(parseStoredCart("{not json"), []);
  });

  it("returns an empty cart for a non-array payload", () => {
    assert.deepEqual(parseStoredCart('{"productId":1}'), []);
    assert.deepEqual(parseStoredCart('"a string"'), []);
    assert.deepEqual(parseStoredCart("42"), []);
  });

  it("round-trips a valid cart", () => {
    const lines = [line(MONSTERA, 2), line(MISTER, 1)];
    assert.deepEqual(parseStoredCart(JSON.stringify(lines)), lines);
  });

  it("drops lines missing required fields", () => {
    const raw = JSON.stringify([
      line(MONSTERA, 1),
      { productId: 2, quantity: 1 },
      { ...MISTER },
      null,
      "garbage",
    ]);
    assert.deepEqual(parseStoredCart(raw), [line(MONSTERA, 1)]);
  });

  it("drops lines with a zero or negative quantity", () => {
    const raw = JSON.stringify([line(MONSTERA, 0), line(MISTER, -3)]);
    assert.deepEqual(parseStoredCart(raw), []);
  });

  it("drops non-integer prices and quantities", () => {
    const raw = JSON.stringify([
      { ...MONSTERA, priceCents: 48.5, quantity: 1 },
      { ...MISTER, quantity: 1.5 },
    ]);
    assert.deepEqual(parseStoredCart(raw), []);
  });

  it("clamps a tampered-with quantity rather than honouring it", () => {
    const raw = JSON.stringify([line(MONSTERA, 1_000_000)]);
    assert.equal(parseStoredCart(raw)[0].quantity, MAX_QUANTITY);
  });
});
