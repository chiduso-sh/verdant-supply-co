/**
 * Pure cart logic.
 *
 * Deliberately free of React and of `window`, so every rule here is unit
 * testable and the provider in components/cart-provider.tsx stays a thin
 * wrapper around it.
 */

export const MAX_QUANTITY = 99;
export const CART_STORAGE_KEY = "verdant.cart.v1";

/**
 * A cart line as held in localStorage.
 *
 * `name`, `priceCents` and `imageUrl` are a DISPLAY SNAPSHOT ONLY. They came
 * from the browser and are therefore untrusted. The server re-reads every
 * price from the database at checkout and ignores whatever is stored here.
 */
export type CartLine = {
  productId: number;
  slug: string;
  name: string;
  priceCents: number;
  imageUrl: string;
  quantity: number;
};

export type NewCartLine = Omit<CartLine, "quantity">;

function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.max(1, Math.min(Math.trunc(quantity), MAX_QUANTITY));
}

/** Adds a line, merging into an existing one for the same product. */
export function addLine(
  lines: readonly CartLine[],
  line: NewCartLine,
  quantity = 1,
): CartLine[] {
  const requested = clampQuantity(quantity);
  const existing = lines.find((l) => l.productId === line.productId);

  if (!existing) {
    return [...lines, { ...line, quantity: requested }];
  }

  return lines.map((l) =>
    l.productId === line.productId
      ? { ...l, quantity: Math.min(l.quantity + requested, MAX_QUANTITY) }
      : l,
  );
}

/** Sets an absolute quantity. Zero or less removes the line entirely. */
export function setLineQuantity(
  lines: readonly CartLine[],
  productId: number,
  quantity: number,
): CartLine[] {
  if (!Number.isFinite(quantity) || Math.trunc(quantity) <= 0) {
    return removeLine(lines, productId);
  }

  return lines.map((l) =>
    l.productId === productId ? { ...l, quantity: clampQuantity(quantity) } : l,
  );
}

export function removeLine(
  lines: readonly CartLine[],
  productId: number,
): CartLine[] {
  return lines.filter((l) => l.productId !== productId);
}

/** Total number of units, not number of distinct lines. */
export function cartCount(lines: readonly CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

/** Display-only subtotal in integer cents. Never used to charge anyone. */
export function cartSubtotalCents(lines: readonly CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
}

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    Number.isInteger(line.productId) &&
    typeof line.slug === "string" &&
    typeof line.name === "string" &&
    Number.isInteger(line.priceCents) &&
    typeof line.imageUrl === "string" &&
    Number.isInteger(line.quantity) &&
    (line.quantity as number) > 0
  );
}

/**
 * Parses whatever is sitting in localStorage.
 *
 * Storage is attacker-writable and also just plain stale, so anything that
 * isn't a well-formed line is dropped rather than trusted. Returns [] for
 * null, malformed JSON, or a non-array payload.
 */
export function parseStoredCart(raw: string | null): CartLine[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isCartLine)
      .map((line) => ({ ...line, quantity: clampQuantity(line.quantity) }));
  } catch {
    return [];
  }
}
