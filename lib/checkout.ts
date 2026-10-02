/**
 * Pure checkout logic: validation, de-duplication, and money.
 *
 * None of this touches the database, the session, or the network, so the
 * rules that decide what someone gets charged are unit testable in isolation.
 * The server action in app/checkout/actions.ts is the thin shell that wires
 * these functions to Neon and Brevo.
 */

import { MAX_QUANTITY } from "./cart";

export type CheckoutLine = { productId: number; quantity: number };

export type ShippingInput = {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
};

export type PricedProduct = {
  id: number;
  name: string;
  priceCents: number;
};

export type OrderItemDraft = {
  productId: number;
  nameSnapshot: string;
  unitPriceCents: number;
  quantity: number;
};

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

const REQUIRED_FIELDS: Array<[keyof ShippingInput, string]> = [
  ["fullName", "Full name"],
  ["line1", "Address"],
  ["city", "City"],
  ["state", "State or region"],
  ["postalCode", "Postal code"],
  ["country", "Country"],
];

export type NormalizedShipping = {
  shippingFullName: string;
  shippingLine1: string;
  shippingLine2: string | null;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  shippingPhone: string | null;
};

/**
 * Checks the required address fields and trims every value.
 *
 * Optional fields collapse to null rather than "" so the database holds one
 * representation of "not provided".
 */
export function validateShipping(
  shipping: ShippingInput,
): Validated<NormalizedShipping> {
  for (const [field, label] of REQUIRED_FIELDS) {
    if (!shipping[field]?.trim()) {
      return { ok: false, error: `${label} is required.` };
    }
  }

  return {
    ok: true,
    value: {
      shippingFullName: shipping.fullName.trim(),
      shippingLine1: shipping.line1.trim(),
      shippingLine2: shipping.line2?.trim() || null,
      shippingCity: shipping.city.trim(),
      shippingState: shipping.state.trim(),
      shippingPostalCode: shipping.postalCode.trim(),
      shippingCountry: shipping.country.trim(),
      shippingPhone: shipping.phone?.trim() || null,
    },
  };
}

/**
 * Collapses a client cart into productId -> quantity.
 *
 * Rejects non-integers and out-of-range quantities instead of coercing them:
 * a cart that arrives malformed is a bug or an attack, and silently rounding
 * it would hide both. Duplicate lines for the same product are summed, then
 * capped.
 */
export function collapseCartLines(
  lines: readonly CheckoutLine[],
): Validated<Map<number, number>> {
  const wanted = new Map<number, number>();

  for (const line of lines) {
    if (!Number.isInteger(line?.productId) || !Number.isInteger(line?.quantity)) {
      return { ok: false, error: "That cart looks malformed. Try again." };
    }
    if (line.quantity < 1 || line.quantity > MAX_QUANTITY) {
      return {
        ok: false,
        error: `Quantities must be between 1 and ${MAX_QUANTITY}.`,
      };
    }

    wanted.set(
      line.productId,
      Math.min((wanted.get(line.productId) ?? 0) + line.quantity, MAX_QUANTITY),
    );
  }

  if (wanted.size === 0) {
    return { ok: false, error: "Your cart is empty." };
  }

  return { ok: true, value: wanted };
}

/**
 * Builds the order items from products read out of the database.
 *
 * Prices and names come from `products` — the database row — never from the
 * cart. Quantities are the only thing the client gets to decide.
 */
export function buildOrderItems(
  products: readonly PricedProduct[],
  wanted: ReadonlyMap<number, number>,
): Validated<OrderItemDraft[]> {
  if (products.length !== wanted.size) {
    return {
      ok: false,
      error: "One of those products no longer exists. Please review your cart.",
    };
  }

  const items: OrderItemDraft[] = [];

  for (const product of products) {
    const quantity = wanted.get(product.id);
    if (quantity === undefined) {
      return {
        ok: false,
        error: "One of those products no longer exists. Please review your cart.",
      };
    }

    items.push({
      productId: product.id,
      nameSnapshot: product.name,
      unitPriceCents: product.priceCents,
      quantity,
    });
  }

  return { ok: true, value: items };
}

/** Integer cents in, integer cents out. No floats anywhere in this path. */
export function computeSubtotalCents(
  items: readonly OrderItemDraft[],
): number {
  return items.reduce(
    (sum, item) => sum + item.unitPriceCents * item.quantity,
    0,
  );
}

/** Address as display lines, with blanks dropped. */
export function formatShippingAddress(shipping: ShippingInput): string[] {
  return [
    shipping.fullName,
    shipping.line1,
    shipping.line2,
    `${shipping.city}, ${shipping.state} ${shipping.postalCode}`.trim(),
    shipping.country,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part) && part !== ",");
}
