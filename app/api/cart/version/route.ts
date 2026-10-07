import { readCartVersion } from "@/lib/server/cart";
import { json, requireCaller, route } from "@/lib/server/http";

export { OPTIONS } from "@/lib/server/http";

/**
 * GET /api/cart/version — the cart's version number and nothing else.
 *
 * This is the polling endpoint. It is a single primary-key read against
 * `cart`, touching neither `cart_item` nor `product`, because the mobile
 * client hits it every couple of seconds while it is in the foreground. When
 * the number changes it follows up with a full `GET /api/cart`.
 *
 * Mobile polls rather than streaming because React Native's EventSource
 * cannot attach an Authorization header; the web app uses /api/cart/stream.
 */
export const GET = route(async (request: Request) => {
  const caller = await requireCaller(request);
  return json({ version: await readCartVersion(caller.userId) });
});

export const dynamic = "force-dynamic";
