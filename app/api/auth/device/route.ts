import { startPairing } from "@/lib/server/device-auth";
import { json, readJsonObject, route } from "@/lib/server/http";

export { OPTIONS } from "@/lib/server/http";

/**
 * POST /api/auth/device — open a device pairing.
 *
 * Body: `{ deviceName?: string }`. Unauthenticated by design: the caller is
 * an app that has nobody signed in yet. What it gets back is a `deviceCode`
 * it keeps, and a `userCode` it shows on screen; neither is worth anything
 * until a signed-in human approves it at `verificationUri`.
 *
 * AUTH_URL is preferred over the request's own origin for the verification
 * link. Behind a proxy or a tunnel the request origin can be an internal
 * hostname the phone's browser cannot reach, and handing someone an
 * unreachable link is the failure mode this flow exists to avoid.
 */
export const POST = route(async (request: Request) => {
  const body = await readJsonObject(request);
  const deviceName =
    typeof body.deviceName === "string" ? body.deviceName : null;

  const baseUrl = process.env.AUTH_URL ?? new URL(request.url).origin;
  const pairing = await startPairing(baseUrl, deviceName);

  return json(pairing, { status: 201 });
});

export const dynamic = "force-dynamic";
