import { listDeviceSessions, revokeToken } from "@/lib/server/device-auth";
import {
  apiError,
  json,
  readJsonObject,
  requireCaller,
  route,
} from "@/lib/server/http";

export { OPTIONS } from "@/lib/server/http";

/**
 * GET /api/auth/device/signout — list this account's paired devices.
 *
 * On the same route as the revoke so the pair is easy to find; there is no
 * separate /devices endpoint to keep in sync.
 */
export const GET = route(async (request: Request) => {
  const caller = await requireCaller(request);
  return json({ devices: await listDeviceSessions(caller.userId) });
});

/**
 * POST /api/auth/device/signout — revoke a token.
 *
 * Body: `{ tokenId? }`. With no body a bearer caller signs *itself* out,
 * which is what the app's own sign-out button does. With a `tokenId` any
 * authenticated caller can revoke one of their own other devices from the
 * website. Ownership is in `revokeToken`'s WHERE clause, so one account can
 * never sign another's device out.
 */
export const POST = route(async (request: Request) => {
  const caller = await requireCaller(request);
  const body = await readJsonObject(request);

  const tokenId =
    typeof body.tokenId === "string" ? body.tokenId : caller.tokenId;

  if (!tokenId) {
    return apiError(
      400,
      "Pass a `tokenId`, or call this with the device's own bearer token.",
      "no_token_id",
    );
  }

  const revoked = await revokeToken(caller.userId, tokenId);
  if (!revoked) {
    return apiError(404, "No such device, or it was already signed out.");
  }

  return json({ ok: true, tokenId });
});

export const dynamic = "force-dynamic";
