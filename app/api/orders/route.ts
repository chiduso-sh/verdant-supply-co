import type { ShippingInput } from "@/lib/checkout";
import { createOrder, listOrders } from "@/lib/server/orders";
import {
  ApiError,
  apiError,
  json,
  readJsonObject,
  readQuantityLines,
  requireCaller,
  route,
} from "@/lib/server/http";

export { OPTIONS } from "@/lib/server/http";

/** GET /api/orders — this caller's orders, newest first. */
export const GET = route(async (request: Request) => {
  const caller = await requireCaller(request);
  return json({ orders: await listOrders(caller.userId) });
});

const SHIPPING_FIELDS: (keyof ShippingInput)[] = [
  "fullName",
  "line1",
  "line2",
  "city",
  "state",
  "postalCode",
  "country",
  "phone",
];

/**
 * Pulls the shipping address out of an untrusted body.
 *
 * Only strings are accepted; the required-field and country checks are
 * `validateShipping`'s job, inside `createOrder`, so there is one place that
 * decides what a valid address is.
 */
function readShipping(value: unknown): ShippingInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApiError(400, "`shipping` should be an object.", "bad_shipping");
  }

  const input = value as Record<string, unknown>;
  const shipping = {} as ShippingInput;

  for (const field of SHIPPING_FIELDS) {
    const raw = input[field];
    if (raw !== undefined && typeof raw !== "string") {
      throw new ApiError(
        400,
        `\`shipping.${field}\` should be a string.`,
        "bad_shipping",
      );
    }
    shipping[field] = (raw as string | undefined) ?? "";
  }

  return shipping;
}

/**
 * POST /api/orders — place an order.
 *
 * Body: `{ shipping: {...}, lines?: [{ productId, quantity }] }`.
 *
 * Omitting `lines` buys whatever is in the server cart, which is what the
 * mobile client does: its cart already lives there, so resending it would
 * only create an opportunity for the two to disagree.
 *
 * Prices are never taken from this body. `createOrder` re-reads every one of
 * them from `product` before writing anything — the most important security
 * property in the codebase, and the one an HTTP API makes easiest to lose.
 * The recipient email comes from the authenticated user, not the request, so
 * a confirmation cannot be pointed at someone else's inbox.
 */
export const POST = route(async (request: Request) => {
  const caller = await requireCaller(request);

  if (!caller.email) {
    return apiError(
      409,
      "Your account has no email address, so we cannot send a confirmation.",
      "no_email",
    );
  }

  const body = await readJsonObject(request);
  const shipping = readShipping(body.shipping);
  const lines =
    body.lines === undefined ? undefined : readQuantityLines(body.lines);

  const result = await createOrder({
    userId: caller.userId,
    email: caller.email,
    name: caller.name,
    lines,
    shipping,
  });

  if (!result.ok) return apiError(result.status, result.error);

  return json(
    {
      order: {
        id: result.orderId,
        orderNumber: result.orderNumber,
      },
      emailSent: result.emailSent,
    },
    { status: 201 },
  );
});

export const dynamic = "force-dynamic";
