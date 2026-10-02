"use server";

import { inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
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

export type { CheckoutLine, ShippingInput } from "@/lib/checkout";

export type PlaceOrderResult =
  | { ok: true; orderId: string; orderNumber: string; emailSent: boolean }
  | { ok: false; error: string };

/**
 * Writes an order, then emails the confirmation.
 *
 * The thin shell: every pricing and validation rule lives in lib/checkout.ts
 * so it can be tested without a database.
 */
export async function placeOrder(
  lines: CheckoutLine[],
  shipping: ShippingInput,
): Promise<PlaceOrderResult> {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email;

  // Checkout is gated on a Google session. The recipient address comes from
  // the session, never from the form, so it cannot be pointed elsewhere.
  if (!userId || !email) {
    return { ok: false, error: "You need to be signed in to place an order." };
  }

  const address = validateShipping(shipping);
  if (!address.ok) return address;

  const collapsed = collapseCartLines(lines);
  if (!collapsed.ok) return collapsed;

  // Re-read every price from the database. The browser's cart is a list of
  // intentions, not a source of truth about money.
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      priceCents: products.priceCents,
    })
    .from(products)
    .where(inArray(products.id, [...collapsed.value.keys()]));

  const built = buildOrderItems(rows, collapsed.value);
  if (!built.ok) return built;

  const items = built.value;
  const subtotalCents = computeSubtotalCents(items);

  const orderId = crypto.randomUUID();
  const orderNumber = generateOrderNumber();

  // db.batch() on the Neon HTTP driver runs these in a single transaction, so
  // an order can never be persisted without its items. The id is generated
  // here rather than by the database precisely so both inserts can be batched.
  await db.batch([
    db.insert(orders).values({
      id: orderId,
      orderNumber,
      userId,
      email,
      status: "confirmed",
      subtotalCents,
      ...address.value,
    }),
    db.insert(orderItems).values(items.map((item) => ({ ...item, orderId }))),
  ]);

  // Email happens AFTER the write and outside it. A failing mail provider
  // must not cost the customer their order.
  const mail = await sendOrderConfirmation({
    to: email,
    recipientName: session.user?.name ?? null,
    orderNumber,
    items: items.map((item) => ({
      name: item.nameSnapshot,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
    })),
    subtotalCents,
    shippingAddress: formatShippingAddress(shipping),
  });

  if (!mail.ok) {
    console.error(
      `[order ${orderNumber}] confirmation email failed:`,
      mail.error,
    );
  }

  revalidatePath("/orders");

  return { ok: true, orderId, orderNumber, emailSent: mail.ok };
}
