/**
 * Order creation and reads, shared by the web server action and the HTTP API.
 *
 * This module exists so there is exactly one implementation of "what does
 * this order cost and who is allowed to see it". `app/checkout/actions.ts`
 * and `app/api/orders/route.ts` are both thin wrappers over `createOrder`.
 * Forking it is how web and mobile would start disagreeing about totals.
 *
 * The pricing rules themselves still live in lib/checkout.ts, which is pure
 * and unit tested. Nothing here re-implements them.
 */

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  buildOrderItems,
  collapseCartLines,
  computeSubtotalCents,
  formatShippingAddress,
  validateShipping,
  type CheckoutLine,
  type ShippingInput,
} from "@/lib/checkout";
import { db } from "@/lib/db";
import { orderItems, orders, products } from "@/lib/db/schema";
import { sendOrderConfirmation } from "@/lib/email";
import { generateOrderNumber } from "@/lib/order-number";
import { clearCart, readCart } from "@/lib/server/cart";

export type CreateOrderInput = {
  userId: string;
  email: string;
  name: string | null;
  /**
   * The lines to buy. Omit to buy whatever is in the server cart — which is
   * what the mobile client does, since its cart already lives there and
   * resending it would just be an opportunity to disagree.
   */
  lines?: readonly CheckoutLine[];
  shipping: ShippingInput;
};

export type CreateOrderOutcome =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      emailSent: boolean;
    }
  | { ok: false; error: string; status: number };

/**
 * Writes an order, empties the cart, then emails the confirmation.
 *
 * Order of operations matters in all three places:
 *
 * 1. Prices are re-read from `product` *after* the client's quantities are
 *    collapsed and *before* anything is written. `buildOrderItems` takes
 *    names and prices only from those database rows. This is the single most
 *    important security property in the codebase and an HTTP API makes it
 *    easier to get wrong, so it is spelled out rather than implied.
 * 2. The order and its items go in one `db.batch()`, so an order can never
 *    exist without its items.
 * 3. The cart is cleared and the email sent only after the write succeeds,
 *    and neither failing can cost the customer their order.
 */
export async function createOrder(
  input: CreateOrderInput,
): Promise<CreateOrderOutcome> {
  const address = validateShipping(input.shipping);
  if (!address.ok) return { ok: false, error: address.error, status: 400 };

  // Lines come from the request when given, otherwise from the server cart.
  // Either way only the quantities survive the next step.
  const sourceLines =
    input.lines ??
    (await readCart(input.userId)).lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
    }));

  const collapsed = collapseCartLines(sourceLines);
  if (!collapsed.ok) return { ok: false, error: collapsed.error, status: 400 };

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      priceCents: products.priceCents,
    })
    .from(products)
    .where(inArray(products.id, [...collapsed.value.keys()]));

  const built = buildOrderItems(rows, collapsed.value);
  if (!built.ok) return { ok: false, error: built.error, status: 409 };

  const items = built.value;
  const subtotalCents = computeSubtotalCents(items);

  const orderId = crypto.randomUUID();
  const orderNumber = generateOrderNumber();

  await db.batch([
    db.insert(orders).values({
      id: orderId,
      orderNumber,
      userId: input.userId,
      email: input.email,
      status: "confirmed",
      subtotalCents,
      ...address.value,
    }),
    db.insert(orderItems).values(items.map((item) => ({ ...item, orderId }))),
  ]);

  // Emptying the server cart is what makes a checkout on the phone clear the
  // cart on the laptop a moment later: it bumps the version every other
  // device is watching. A failure here must not fail the order, so it is
  // logged and swallowed.
  try {
    await clearCart(input.userId);
  } catch (error) {
    console.error(
      `[order ${orderNumber}] cart was not cleared after checkout:`,
      error,
    );
  }

  const mail = await sendOrderConfirmation({
    to: input.email,
    recipientName: input.name,
    orderNumber,
    items: items.map((item) => ({
      name: item.nameSnapshot,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
    })),
    subtotalCents,
    shippingAddress: formatShippingAddress(input.shipping),
  });

  if (!mail.ok) {
    console.error(
      `[order ${orderNumber}] confirmation email failed:`,
      mail.error,
    );
  }

  return { ok: true, orderId, orderNumber, emailSent: mail.ok };
}

export type OrderSummary = {
  id: string;
  orderNumber: string;
  status: string;
  subtotalCents: number;
  createdAt: string;
};

export type OrderDetail = OrderSummary & {
  email: string;
  items: {
    id: number;
    productId: number;
    name: string;
    unitPriceCents: number;
    quantity: number;
  }[];
  shipping: {
    fullName: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string | null;
  };
  addressLines: string[];
};

/** This user's orders, newest first. */
export async function listOrders(userId: string): Promise<OrderSummary[]> {
  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      subtotalCents: orders.subtotalCents,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * One order, or null.
 *
 * Ownership is part of the WHERE clause rather than a check after the fact,
 * exactly as in app/orders/[id]/page.tsx. A guessed id returns null — and so
 * a 404 — instead of someone else's shipping address. Every new route that
 * reads an order has to keep doing it this way.
 */
export async function readOrder(
  userId: string,
  orderId: string,
): Promise<OrderDetail | null> {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);

  if (!order) return null;

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))
    .orderBy(asc(orderItems.id));

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    subtotalCents: order.subtotalCents,
    createdAt: order.createdAt.toISOString(),
    email: order.email,
    items: items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.nameSnapshot,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
    })),
    shipping: {
      fullName: order.shippingFullName,
      line1: order.shippingLine1,
      line2: order.shippingLine2,
      city: order.shippingCity,
      state: order.shippingState,
      postalCode: order.shippingPostalCode,
      country: order.shippingCountry,
      phone: order.shippingPhone,
    },
    addressLines: [
      order.shippingFullName,
      order.shippingLine1,
      order.shippingLine2,
      `${order.shippingCity}, ${order.shippingState} ${order.shippingPostalCode}`,
      order.shippingCountry,
      order.shippingPhone,
    ].filter((line): line is string => Boolean(line)),
  };
}
