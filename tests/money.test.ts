import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatCents } from "../lib/money";

describe("formatCents", () => {
  it("formats whole dollars", () => {
    assert.equal(formatCents(4800), "$48.00");
    assert.equal(formatCents(7200), "$72.00");
  });

  it("formats zero", () => {
    assert.equal(formatCents(0), "$0.00");
  });

  it("formats a single cent without losing it", () => {
    assert.equal(formatCents(1), "$0.01");
  });

  it("keeps both decimal places for non-round values", () => {
    assert.equal(formatCents(1805), "$18.05");
    assert.equal(formatCents(1850), "$18.50");
  });

  it("groups thousands", () => {
    assert.equal(formatCents(123456), "$1,234.56");
    assert.equal(formatCents(100000000), "$1,000,000.00");
  });

  it("formats negatives (refund-shaped values)", () => {
    assert.equal(formatCents(-4800), "-$48.00");
  });

  it("never renders a floating point artefact", () => {
    // 0.1 + 0.2 territory: the whole reason prices are stored as cents.
    for (const cents of [1, 3, 7, 29, 333, 1999, 9999]) {
      assert.match(
        formatCents(cents),
        /^\$\d{1,3}(,\d{3})*\.\d{2}$/,
        `formatCents(${cents}) produced ${formatCents(cents)}`,
      );
    }
  });
});
