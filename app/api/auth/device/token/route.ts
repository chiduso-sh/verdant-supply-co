import { exchangePairing } from "@/lib/server/device-auth";
import {
  ApiError,
  apiError,
  json,
  readJsonObject,
  route,
} from "@/lib/server/http";

export { OPTIONS } from "@/lib/server/http";

/**
 * POST /api/auth/device/token — poll a pairing, and exchange it once approved.
 *
 * Body: `{ deviceCode }`.
 *
 * Statuses mirror RFC 8628 closely enough to be unsurprising:
 *
 * - 202 `{ status: "pending" }` — keep polling at `intervalSeconds`.
 * - 200 `{ status: "approved", token, expiresAt }` — store the token. Once.
 * - 403 denied, 410 expired or already exchanged, 404 unknown code.
 *
 * The exchange is single-use: `exchangePairing` stamps the row inside the
 * same conditional update that claims it, so two polls in flight cannot
 * produce two tokens from one approval.
 */
export const POST = route(async (request: Request) => {
  const body = await readJsonObject(request);

  if (typeof body.deviceCode !== "string" || !body.deviceCode) {
    throw new ApiError(400, "`deviceCode` is required.");
  }

  const result = await exchangePairing(body.deviceCode);

  switch (result.status) {
    case "pending":
      return json(result, { status: 202 });
    case "approved":
      return json(result);
    case "denied":
      return apiError(403, "That pairing was declined.", "denied");
    case "expired":
      return apiError(
        410,
        "That pairing has expired or was already used. Start again.",
        "expired",
      );
    case "unknown":
      return apiError(404, "No such pairing.", "unknown");
  }
});

export const dynamic = "force-dynamic";
