import { addToCart } from "@/lib/server/cart";
import {
  ApiError,
  json,
  readJsonObject,
  requireCaller,
  route,
} from "@/lib/server/http";

export { OPTIONS } from "@/lib/server/http";

/**
 * POST /api/cart/items — add to the cart.
 *
 * Body: `{ productId, quantity? }`. Increments rather than replaces, which is
 * what "add to cart" means on both clients, and does it in a single upsert so
 * two devices adding at once both land.
 */
export const POST = route(async (request: Request) => {
  const caller = await requireCaller(request);
  const body = await readJsonObject(request);

  if (!Number.isInteger(body.productId)) {
    throw new ApiError(400, "`productId` should be an integer.");
  }

  const quantity = body.quantity ?? 1;
  if (!Number.isInteger(quantity)) {
    throw new ApiError(400, "`quantity` should be an integer.");
  }

  const cart = await addToCart(
    caller.userId,
    body.productId as number,
    quantity as number,
  );

  return json({ cart }, { status: 201 });
});

export const dynamic = "force-dynamic";
