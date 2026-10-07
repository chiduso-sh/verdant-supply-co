import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_QUANTITY } from "../lib/cart";
import {
  mergeCarts,
  normalizeQuantityLines,
  sameCart,
  type QuantityLine,
} from "../lib/cart-merge";

const line = (productId: number, quantity: number): QuantityLine => ({
  productId,
  quantity,
});

describe("normalizeQuantityLines", () => {
  it("returns an empty array for an empty cart", () => {
    assert.deepEqual(normalizeQuantityLines([]), []);
  });

  it("sorts by product id so output is stable", () => {
    assert.deepEqual(normalizeQuantityLines([line(9, 1), line(2, 1)]), [
      line(2, 1),
      line(9, 1),
    ]);
  });

  it("sums duplicate lines for the same product", () => {
    assert.deepEqual(normalizeQuantityLines([line(3, 2), line(3, 5)]), [
      line(3, 7),
    ]);
  });

  it("caps a summed duplicate at MAX_QUANTITY", () => {
    assert.deepEqual(
      normalizeQuantityLines([line(3, MAX_QUANTITY), line(3, 40)]),
      [line(3, MAX_QUANTITY)],
    );
  });

  it("truncates fractional quantities rather than rounding up", () => {
    assert.deepEqual(normalizeQuantityLines([line(4, 2.9)]), [line(4, 2)]);
  });

  it("drops lines whose quantity truncates below one", () => {
    assert.deepEqual(normalizeQuantityLines([line(4, 0.5), line(5, 3)]), [
      line(5, 3),
    ]);
  });

  it("drops zero, negative, NaN and Infinity quantities", () => {
    assert.deepEqual(
      normalizeQuantityLines([
        line(1, 0),
        line(2, -4),
        line(3, Number.NaN),
        line(4, Number.POSITIVE_INFINITY),
      ]),
      [],
    );
  });

  it("drops lines with a non-integer product id", () => {
    assert.deepEqual(
      normalizeQuantityLines([
        line(1.5, 2),
        { productId: "7" as unknown as number, quantity: 2 },
        line(8, 1),
      ]),
      [line(8, 1)],
    );
  });

  it("drops null and undefined entries instead of throwing", () => {
    const ragged = [
      null,
      undefined,
      line(2, 1),
    ] as unknown as QuantityLine[];
    assert.deepEqual(normalizeQuantityLines(ragged), [line(2, 1)]);
  });
});

describe("mergeCarts", () => {
  it("returns the server cart when local is empty", () => {
    assert.deepEqual(mergeCarts([], [line(1, 2)]), [line(1, 2)]);
  });

  it("returns the local cart when the server cart is empty", () => {
    assert.deepEqual(mergeCarts([line(1, 2)], []), [line(1, 2)]);
  });

  it("is a union: a product in only one cart survives", () => {
    assert.deepEqual(mergeCarts([line(1, 1)], [line(2, 3)]), [
      line(1, 1),
      line(2, 3),
    ]);
  });

  it("takes the larger quantity for a shared product by default", () => {
    assert.deepEqual(mergeCarts([line(1, 2)], [line(1, 5)]), [line(1, 5)]);
    assert.deepEqual(mergeCarts([line(1, 7)], [line(1, 5)]), [line(1, 7)]);
  });

  it("does not double a product added on both devices", () => {
    // The whole reason "max" is the default rather than "sum".
    assert.deepEqual(mergeCarts([line(1, 1)], [line(1, 1)]), [line(1, 1)]);
  });

  it("sums shared products under the sum strategy", () => {
    assert.deepEqual(mergeCarts([line(1, 2)], [line(1, 5)], "sum"), [
      line(1, 7),
    ]);
  });

  it("caps a summed quantity at MAX_QUANTITY", () => {
    assert.deepEqual(
      mergeCarts([line(1, MAX_QUANTITY)], [line(1, MAX_QUANTITY)], "sum"),
      [line(1, MAX_QUANTITY)],
    );
  });

  it("prefers the server quantity under the server strategy", () => {
    assert.deepEqual(mergeCarts([line(1, 9)], [line(1, 2)], "server"), [
      line(1, 2),
    ]);
  });

  it("prefers the local quantity under the local strategy", () => {
    assert.deepEqual(mergeCarts([line(1, 9)], [line(1, 2)], "local"), [
      line(1, 9),
    ]);
  });

  it("keeps one-sided products untouched under every strategy", () => {
    for (const strategy of ["max", "sum", "server", "local"] as const) {
      assert.deepEqual(
        mergeCarts([line(1, 4)], [line(2, 6)], strategy),
        [line(1, 4), line(2, 6)],
        `strategy ${strategy} dropped a one-sided product`,
      );
    }
  });

  it("normalizes malformed input on both sides", () => {
    assert.deepEqual(
      mergeCarts([line(1, 0), line(2, 3)], [line(2, 1), line(1.5, 9)]),
      [line(2, 3)],
    );
  });

  it("sorts the result by product id", () => {
    assert.deepEqual(
      mergeCarts([line(30, 1), line(4, 1)], [line(12, 1)]),
      [line(4, 1), line(12, 1), line(30, 1)],
    );
  });

  it("is idempotent: merging a result with itself changes nothing", () => {
    const once = mergeCarts([line(1, 2)], [line(2, 5)]);
    assert.deepEqual(mergeCarts(once, once), once);
  });
});

describe("sameCart", () => {
  it("is true for two empty carts", () => {
    assert.equal(sameCart([], []), true);
  });

  it("ignores line order", () => {
    assert.equal(sameCart([line(2, 1), line(1, 3)], [line(1, 3), line(2, 1)]), true);
  });

  it("is false when a quantity differs", () => {
    assert.equal(sameCart([line(1, 2)], [line(1, 3)]), false);
  });

  it("is false when one cart has an extra product", () => {
    assert.equal(sameCart([line(1, 2)], [line(1, 2), line(2, 1)]), false);
  });

  it("treats duplicate lines as their sum", () => {
    assert.equal(sameCart([line(1, 1), line(1, 1)], [line(1, 2)]), true);
  });

  it("ignores lines that normalize away", () => {
    assert.equal(sameCart([line(1, 2), line(3, 0)], [line(1, 2)]), true);
  });
});
