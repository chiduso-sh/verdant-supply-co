"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import type { CheckoutLine, ShippingInput } from "@/lib/checkout";
import { createOrder } from "@/lib/server/orders";

export type { CheckoutLine, ShippingInput } from "@/lib/checkout";

export type PlaceOrderResult =
  | { ok: true; orderId: string; orderNumber: string; emailSent: boolean }
  | { ok: false; error: string };

/**
 * The web checkout path.
 *
 * Now a thin wrapper: every pricing, validation and ownership rule lives in
 * `createOrder` (lib/server/orders.ts), which `POST /api/orders` calls too.
 * A server action is not reachable from a native client — it is an RPC
 * protocol tied to a build-specific action id — so the API route exists
 * alongside this rather than replacing it, and they must not drift.
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

  const result = await createOrder({
    userId,
    email,
    name: session.user?.name ?? null,
    lines,
    shipping,
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/orders");

  return {
    ok: true,
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    emailSent: result.emailSent,
  };
}
