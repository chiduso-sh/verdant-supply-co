import {
  clearCart,
  readCart,
  writeCart,
} from "@/lib/server/cart";
import {
  json,
  readJsonObject,
  readQuantityLines,
  requireCaller,
  route,
} from "@/lib/server/http";

export { OPTIONS } from "@/lib/server/http";

/**
 * GET /api/cart — the signed-in user's cart, hydrated from the catalogue.
 *
 * Display fields in the response come from `product`, not from whatever the
 * client last sent, so a stale client cannot talk the server into a price.
 */
export const GET = route(async (request: Request) => {
  const caller = await requireCaller(request);
  return json({ cart: await readCart(caller.userId) });
});

/**
 * PUT /api/cart — replace the whole cart.
 *
 * Body: `{ lines: [{ productId, quantity }] }`. A full replace rather than a
 * patch, for the client that knows exactly what the cart should be (the web
 * provider after a local edit). Per-item routes exist for everything else.
 */
export const PUT = route(async (request: Request) => {
  const caller = await requireCaller(request);
  const body = await readJsonObject(request);
  const lines = readQuantityLines(body.lines ?? []);

  return json({ cart: await writeCart(caller.userId, lines) });
});

/** DELETE /api/cart — empty it. */
export const DELETE = route(async (request: Request) => {
  const caller = await requireCaller(request);
  return json({ cart: await clearCart(caller.userId) });
});

export const dynamic = "force-dynamic";
