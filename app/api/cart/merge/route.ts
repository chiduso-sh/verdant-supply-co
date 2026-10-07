import type { MergeStrategy } from "@/lib/cart-merge";
import { mergeIntoCart } from "@/lib/server/cart";
import {
  ApiError,
  json,
  readJsonObject,
  readQuantityLines,
  requireCaller,
  route,
} from "@/lib/server/http";

export { OPTIONS } from "@/lib/server/http";

const STRATEGIES: MergeStrategy[] = ["max", "sum", "server", "local"];

/**
 * POST /api/cart/merge — fold a client's local cart into the server cart.
 *
 * Body: `{ lines: [{ productId, quantity }], strategy? }`.
 *
 * This is the localStorage migration path. The first time a browser loads
 * signed in after this deploy it has a cart in `verdant.cart.v1` that the
 * server has never seen; it posts it here, adopts the result, and drops its
 * local copy. Mobile uses the same route on first sign-in.
 *
 * `strategy` defaults to `max`, which is the shipped rule: the common case is
 * one person who added the same item on two devices and wants one of it.
 * The others are exposed for debugging and are not used by either client.
 */
export const POST = route(async (request: Request) => {
  const caller = await requireCaller(request);
  const body = await readJsonObject(request);
  const lines = readQuantityLines(body.lines ?? []);

  const strategy = (body.strategy as MergeStrategy | undefined) ?? "max";
  if (!STRATEGIES.includes(strategy)) {
    throw new ApiError(
      400,
      `\`strategy\` should be one of ${STRATEGIES.join(", ")}.`,
    );
  }

  return json({ cart: await mergeIntoCart(caller.userId, lines, strategy) });
});

export const dynamic = "force-dynamic";
