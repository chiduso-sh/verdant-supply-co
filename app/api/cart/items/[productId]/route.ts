import { removeFromCart, setCartQuantity } from "@/lib/server/cart";
import {
  ApiError,
  json,
  readIntParam,
  readJsonObject,
  requireCaller,
  route,
} from "@/lib/server/http";

export { OPTIONS } from "@/lib/server/http";

type Context = { params: Promise<{ productId: string }> };

/**
 * PATCH /api/cart/items/:productId — set an absolute quantity.
 *
 * Body: `{ quantity }`. Zero or less removes the line, matching
 * `setLineQuantity` in lib/cart.ts so the two clients behave identically.
 */
export const PATCH = route(async (request: Request, context: Context) => {
  const caller = await requireCaller(request);
  const { productId } = await context.params;
  const body = await readJsonObject(request);

  if (!Number.isInteger(body.quantity)) {
    throw new ApiError(400, "`quantity` should be an integer.");
  }

  const cart = await setCartQuantity(
    caller.userId,
    readIntParam(productId, "productId"),
    body.quantity as number,
  );

  return json({ cart });
});

/** DELETE /api/cart/items/:productId */
export const DELETE = route(async (request: Request, context: Context) => {
  const caller = await requireCaller(request);
  const { productId } = await context.params;

  const cart = await removeFromCart(
    caller.userId,
    readIntParam(productId, "productId"),
  );

  return json({ cart });
});

export const dynamic = "force-dynamic";
