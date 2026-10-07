"use server";

import { auth } from "@/auth";
import { approvePairing, denyPairing } from "@/lib/server/device-auth";

export type LinkState =
  | { status: "idle" }
  | { status: "approved"; deviceName: string | null }
  | { status: "denied" }
  | { status: "error"; error: string };

/**
 * Approves or declines a device pairing for the signed-in user.
 *
 * One action with an `intent` field rather than two actions bound to two
 * buttons: both buttons then submit the same form, so the code that gets
 * acted on is unambiguously the one in the field the person is looking at.
 * The intent rides in on the submitter's own name/value, which React includes
 * in the FormData.
 *
 * A server action rather than an API route because this is the one step of
 * the pairing flow that is only ever performed by a human in a browser with a
 * cookie session — it should not be reachable as a public endpoint at all.
 * The phone's half of the exchange is POST /api/auth/device/token.
 */
export async function respondToDevice(
  _previous: LinkState,
  formData: FormData,
): Promise<LinkState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: "error", error: "Sign in first, then try the code again." };
  }

  const code = String(formData.get("code") ?? "");
  const intent = String(formData.get("intent") ?? "approve");

  if (intent === "decline") {
    const declined = await denyPairing(code);
    if (!declined.ok) {
      return {
        status: "error",
        error: "That code was not recognised. It may have already expired.",
      };
    }
    return { status: "denied" };
  }

  const result = await approvePairing(code, session.user.id);
  if (!result.ok) return { status: "error", error: result.error };

  return { status: "approved", deviceName: result.deviceName };
}
