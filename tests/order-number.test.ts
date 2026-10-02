import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateOrderNumber,
  ORDER_NUMBER_ALPHABET,
  ORDER_NUMBER_LENGTH,
  ORDER_NUMBER_PATTERN,
  orderNumberFromBytes,
} from "../lib/order-number";

describe("orderNumberFromBytes", () => {
  it("is deterministic for fixed bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5]);
    assert.equal(orderNumberFromBytes(bytes), orderNumberFromBytes(bytes));
  });

  it("maps bytes through the alphabet by modulo", () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5]);
    assert.equal(orderNumberFromBytes(bytes), "VS-ABCDEF");
  });

  it("wraps bytes larger than the alphabet", () => {
    // 31 chars in the alphabet, so byte 31 wraps back to index 0 ("A").
    assert.equal(
      orderNumberFromBytes(new Uint8Array([31, 32, 33, 34, 35, 36])),
      "VS-ABCDEF",
    );
  });

  it("uses only the first six bytes", () => {
    const six = new Uint8Array([0, 0, 0, 0, 0, 0]);
    const ten = new Uint8Array([0, 0, 0, 0, 0, 0, 9, 9, 9, 9]);
    assert.equal(orderNumberFromBytes(ten), orderNumberFromBytes(six));
  });

  it("handles the maximum byte value", () => {
    const result = orderNumberFromBytes(new Uint8Array(6).fill(255));
    assert.match(result, ORDER_NUMBER_PATTERN);
  });
});

describe("generateOrderNumber", () => {
  it("matches the expected shape", () => {
    assert.match(generateOrderNumber(), ORDER_NUMBER_PATTERN);
  });

  it("is prefixed and the right length", () => {
    const value = generateOrderNumber();
    assert.ok(value.startsWith("VS-"));
    assert.equal(value.length, 3 + ORDER_NUMBER_LENGTH);
  });

  it("matches the shape across many draws", () => {
    for (let i = 0; i < 2000; i += 1) {
      assert.match(generateOrderNumber(), ORDER_NUMBER_PATTERN);
    }
  });

  it("does not collide often enough to matter at this scale", () => {
    // Not a uniqueness guarantee — the UNIQUE index on order_number is what
    // actually enforces that. This only catches a broken random source,
    // e.g. one that returns the same value every call.
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i += 1) seen.add(generateOrderNumber());
    assert.ok(
      seen.size > 4950,
      `expected near-5000 distinct values, got ${seen.size}`,
    );
  });
});

describe("ORDER_NUMBER_ALPHABET", () => {
  it("excludes characters that are misread aloud or on screen", () => {
    for (const char of ["I", "L", "O", "0", "1"]) {
      assert.ok(
        !ORDER_NUMBER_ALPHABET.includes(char),
        `${char} should not be in the alphabet`,
      );
    }
  });

  it("has no duplicate characters", () => {
    assert.equal(
      new Set(ORDER_NUMBER_ALPHABET).size,
      ORDER_NUMBER_ALPHABET.length,
    );
  });

  it("is uppercase and alphanumeric only", () => {
    assert.match(ORDER_NUMBER_ALPHABET, /^[A-Z2-9]+$/);
  });
});
