/**
 * The server-side cart: the database half of cart sync.
 *
 * Everything here is I/O. The rules it applies live in lib/cart.ts and
 * lib/cart-merge.ts, which are pure and unit tested — this module is the thin
 * shell that wires them to Neon, in the same shape as app/checkout/actions.ts.
 *
 * One invariant runs through all of it: a cart line carries a product id and
 * a quantity, and nothing else. Name, price and image are re-read from
 * `product` on every read, so the client's copy of a price can never travel
 * back in and influence anything.
 */

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { cartSubtotalCents, MAX_QUANTITY, type CartLine } from "@/lib/cart";
import {
  mergeCarts,
  normalizeQuantityLines,
  sameCart,
  type MergeStrategy,
  type QuantityLine,
} from "@/lib/cart-merge";
import { db } from "@/lib/db";
import { cartItems, carts, products } from "@/lib/db/schema";

/** What every cart endpoint returns. `version` is what pollers compare. */
export type ServerCart = {
  version: number;
  lines: CartLine[];
  count: number;
  subtotalCents: number;
  updatedAt: string | null;
};

/** An error with an HTTP status attached, so route handlers stay thin. */
export class CartError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "CartError";
  }
}

const EMPTY_CART: ServerCart = {
  version: 0,
  lines: [],
  count: 0,
  subtotalCents: 0,
  updatedAt: null,
};

/**
 * The statement that creates the cart on first write and bumps its version on
 * every later one.
 *
 * Every mutation below opens with this. The bump is what a polling or
 * streaming client watches, so a mutation that forgot it would be invisible
 * to the user's other devices — having exactly one copy of it makes that
 * mistake hard to make.
 *
 * Versions start at 1, so 0 can unambiguously mean "no cart row yet".
 */
function bumpVersion(userId: string) {
  return db
    .insert(carts)
    .values({ userId, version: 1, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: carts.userId,
      set: { version: sql`${carts.version} + 1`, updatedAt: new Date() },
    });
}

/**
 * Reads the cart, joined against the live catalogue.
 *
 * An inner join does double duty here: it hydrates the display fields, and it
 * silently drops any line whose product has since been deleted. A cart that
 * references a dead product should render as if that line is gone, not 500.
 */
export async function readCart(userId: string): Promise<ServerCart> {
  const [cartRow] = await db
    .select({ version: carts.version, updatedAt: carts.updatedAt })
    .from(carts)
    .where(eq(carts.userId, userId))
    .limit(1);

  if (!cartRow) return EMPTY_CART;

  const rows = await db
    .select({
      productId: cartItems.productId,
      quantity: cartItems.quantity,
      slug: products.slug,
      name: products.name,
      priceCents: products.priceCents,
      imageUrl: products.imageUrl,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .where(eq(cartItems.userId, userId))
    .orderBy(asc(cartItems.productId));

  const lines: CartLine[] = rows.map((row) => ({
    productId: row.productId,
    slug: row.slug,
    name: row.name,
    priceCents: row.priceCents,
    imageUrl: row.imageUrl,
    quantity: row.quantity,
  }));

  return {
    version: cartRow.version,
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalCents: cartSubtotalCents(lines),
    updatedAt: cartRow.updatedAt.toISOString(),
  };
}

/**
 * Just the version number.
 *
 * This is what a polling client hits every couple of seconds, so it stays a
 * single primary-key read and never touches `cart_item` or `product`.
 */
export async function readCartVersion(userId: string): Promise<number> {
  const [row] = await db
    .select({ version: carts.version })
    .from(carts)
    .where(eq(carts.userId, userId))
    .limit(1);

  return row?.version ?? 0;
}

/** Current lines as bare quantities, for callers that are about to merge. */
async function readQuantityLines(userId: string): Promise<QuantityLine[]> {
  return db
    .select({ productId: cartItems.productId, quantity: cartItems.quantity })
    .from(cartItems)
    .where(eq(cartItems.userId, userId))
    .orderBy(asc(cartItems.productId));
}

/** Product ids that actually exist, so a write cannot reference a dead row. */
async function existingProductIds(
  ids: readonly number[],
): Promise<Set<number>> {
  if (ids.length === 0) return new Set();

  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(inArray(products.id, [...ids]));

  return new Set(rows.map((row) => row.id));
}

async function requireProduct(productId: number): Promise<void> {
  if (!Number.isInteger(productId)) {
    throw new CartError(400, "That product id is not valid.");
  }
  const live = await existingProductIds([productId]);
  if (!live.has(productId)) {
    throw new CartError(404, "That product no longer exists.");
  }
}

/**
 * Replaces the cart wholesale and bumps the version.
 *
 * Delete-then-insert rather than a diff: the cart is at most a few dozen rows,
 * and a full replace has no partial-update failure modes to reason about. The
 * statements go through `db.batch()`, which on the Neon HTTP driver is the
 * only transaction primitive available (there is no `db.transaction()`), so a
 * reader on another device can never observe the cart mid-rewrite.
 *
 * Lines referencing a product that no longer exists are dropped rather than
 * rejected: the client that sent them may simply be stale, and failing its
 * whole cart over one dead product would be worse than quietly losing a line.
 */
export async function writeCart(
  userId: string,
  lines: readonly QuantityLine[],
): Promise<ServerCart> {
  const normalized = normalizeQuantityLines(lines);
  const live = await existingProductIds(normalized.map((l) => l.productId));
  const kept = normalized.filter((line) => live.has(line.productId));

  // Branched rather than pushed into an array: db.batch() takes a non-empty
  // tuple, and spelling both cases out keeps that typed instead of cast.
  if (kept.length === 0) {
    await db.batch([
      bumpVersion(userId),
      db.delete(cartItems).where(eq(cartItems.userId, userId)),
    ]);
  } else {
    await db.batch([
      bumpVersion(userId),
      db.delete(cartItems).where(eq(cartItems.userId, userId)),
      db.insert(cartItems).values(
        kept.map((line) => ({
          userId,
          productId: line.productId,
          quantity: Math.min(line.quantity, MAX_QUANTITY),
        })),
      ),
    ]);
  }

  return readCart(userId);
}

/**
 * Adds a quantity to one product, creating the line if needed.
 *
 * A targeted upsert rather than read-modify-write, so two devices adding the
 * same product at the same moment both land instead of one silently
 * overwriting the other. The cap is applied in SQL with LEAST for the same
 * reason: the clamp has to happen where the increment happens.
 */
export async function addToCart(
  userId: string,
  productId: number,
  quantity: number,
): Promise<ServerCart> {
  await requireProduct(productId);
  const wanted = Math.max(1, Math.min(Math.trunc(quantity) || 1, MAX_QUANTITY));

  await db.batch([
    bumpVersion(userId),
    db
      .insert(cartItems)
      .values({ userId, productId, quantity: wanted })
      .onConflictDoUpdate({
        target: [cartItems.userId, cartItems.productId],
        set: {
          quantity: sql`LEAST(${cartItems.quantity} + ${wanted}, ${MAX_QUANTITY})`,
        },
      }),
  ]);

  return readCart(userId);
}

/**
 * Sets an absolute quantity. Zero or less removes the line, matching
 * `setLineQuantity` in lib/cart.ts so web and mobile behave identically.
 */
export async function setCartQuantity(
  userId: string,
  productId: number,
  quantity: number,
): Promise<ServerCart> {
  const wanted = Math.trunc(quantity);

  if (!Number.isFinite(wanted) || wanted <= 0) {
    return removeFromCart(userId, productId);
  }

  await requireProduct(productId);
  const capped = Math.min(Math.max(wanted, 1), MAX_QUANTITY);

  await db.batch([
    bumpVersion(userId),
    db
      .insert(cartItems)
      .values({ userId, productId, quantity: capped })
      .onConflictDoUpdate({
        target: [cartItems.userId, cartItems.productId],
        set: { quantity: capped },
      }),
  ]);

  return readCart(userId);
}

export async function removeFromCart(
  userId: string,
  productId: number,
): Promise<ServerCart> {
  await db.batch([
    bumpVersion(userId),
    db
      .delete(cartItems)
      .where(
        and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)),
      ),
  ]);

  return readCart(userId);
}

/**
 * Empties the cart.
 *
 * Called after an order is placed, which is what makes a checkout on the
 * phone empty the cart on the laptop a second later.
 */
export async function clearCart(userId: string): Promise<ServerCart> {
  return writeCart(userId, []);
}

/**
 * Folds a client's local cart into the server cart.
 *
 * This is the localStorage migration path: the first time a browser loads
 * signed in after this deploy, it pushes whatever it has here and adopts the
 * result. The merge rule itself is `mergeCarts`, which is pure and tested.
 *
 * A merge that changes nothing does not write, so signing in on a third
 * device does not bump the version and wake every other client for nothing.
 */
export async function mergeIntoCart(
  userId: string,
  localLines: readonly QuantityLine[],
  strategy: MergeStrategy = "max",
): Promise<ServerCart> {
  const serverLines = await readQuantityLines(userId);
  const merged = mergeCarts(localLines, serverLines, strategy);
  const current = await readCart(userId);

  // version === 0 means there is no cart row at all. Write even for an empty
  // merge in that case, so the row exists and version comparisons have
  // something to read from here on.
  if (current.version > 0 && sameCart(merged, serverLines)) return current;

  return writeCart(userId, merged);
}
