/**
 * Pure cart-merge logic.
 *
 * When someone signs in, two carts exist: whatever is in this browser's
 * localStorage and whatever the server already holds from another device.
 * One of them has to win per product. This module decides that, with no
 * database and no React in sight so the rule is unit testable.
 */

import { MAX_QUANTITY } from "./cart";

/**
 * A cart line reduced to the only two fields the server trusts.
 *
 * Display fields (name, price, image) are deliberately absent: the server
 * re-reads those from `product` on every read, so merging must never carry a
 * client's idea of a price across.
 */
export type QuantityLine = { productId: number; quantity: number };

/**
 * How to resolve a product that exists in both carts.
 *
 * `max` is the default and the shipped behaviour. The reasoning: the common
 * case is one person who added the same item on their phone and their laptop
 * before signing in, and they want one of it, not two. `sum` would silently
 * double that. `server` and `local` exist for completeness and are used by
 * tests; nothing in the app selects them today.
 */
export type MergeStrategy = "max" | "sum" | "server" | "local";

function clamp(quantity: number): number {
  return Math.max(1, Math.min(Math.trunc(quantity), MAX_QUANTITY));
}

/**
 * Drops anything malformed and sums duplicate lines for the same product.
 *
 * Unlike `collapseCartLines` in lib/checkout.ts this is forgiving rather than
 * strict: its input is a *stale local cart*, not a checkout request. Refusing
 * to sign someone in because one line in localStorage went bad would be a
 * worse outcome than quietly dropping that line. Checkout still validates
 * strictly, so nothing malformed can reach an order.
 */
export function normalizeQuantityLines(
  lines: readonly QuantityLine[],
): QuantityLine[] {
  const totals = new Map<number, number>();

  for (const line of lines) {
    if (!Number.isInteger(line?.productId)) continue;
    if (!Number.isFinite(line?.quantity) || Math.trunc(line.quantity) < 1) {
      continue;
    }
    totals.set(
      line.productId,
      clamp((totals.get(line.productId) ?? 0) + Math.trunc(line.quantity)),
    );
  }

  return [...totals]
    .map(([productId, quantity]) => ({ productId, quantity }))
    .sort((a, b) => a.productId - b.productId);
}

function resolve(
  strategy: MergeStrategy,
  local: number | undefined,
  server: number | undefined,
): number {
  // A product present in only one cart survives regardless of strategy:
  // merging is a union, never an intersection. Losing an item someone picked
  // out is the one outcome worse than a wrong quantity.
  if (local === undefined) return server!;
  if (server === undefined) return local;

  switch (strategy) {
    case "sum":
      return local + server;
    case "server":
      return server;
    case "local":
      return local;
    case "max":
      return Math.max(local, server);
  }
}

/**
 * Unions two carts, resolving shared products with `strategy`.
 *
 * Output is normalized and sorted by product id, so the result is stable and
 * two clients that merge the same pair of carts agree byte for byte.
 */
export function mergeCarts(
  local: readonly QuantityLine[],
  server: readonly QuantityLine[],
  strategy: MergeStrategy = "max",
): QuantityLine[] {
  const localById = new Map(
    normalizeQuantityLines(local).map((l) => [l.productId, l.quantity]),
  );
  const serverById = new Map(
    normalizeQuantityLines(server).map((l) => [l.productId, l.quantity]),
  );

  const productIds = [
    ...new Set([...localById.keys(), ...serverById.keys()]),
  ].sort((a, b) => a - b);

  return productIds.map((productId) => ({
    productId,
    quantity: clamp(
      resolve(strategy, localById.get(productId), serverById.get(productId)),
    ),
  }));
}

/**
 * True when two carts hold exactly the same products at the same quantities.
 *
 * Used to skip pointless writes: a merge that changes nothing should not bump
 * the cart version and wake up every other device.
 */
export function sameCart(
  a: readonly QuantityLine[],
  b: readonly QuantityLine[],
): boolean {
  const left = normalizeQuantityLines(a);
  const right = normalizeQuantityLines(b);

  return (
    left.length === right.length &&
    left.every(
      (line, index) =>
        line.productId === right[index].productId &&
        line.quantity === right[index].quantity,
    )
  );
}
