/**
 * Device pairing: how a native app ends up holding a bearer token for the
 * same `user` row the website signs into.
 *
 * The shape is RFC 8628's device-authorization grant. The app asks for a
 * pairing, shows an eight-character code, and polls. The person approves that
 * code in a normal browser, where the existing Google cookie session already
 * works.
 *
 * Choosing this over native Google Sign-In was deliberate: the phone never
 * touches Google credentials, no second OAuth client is needed, and — the
 * part that actually saves time — no new authorized redirect URI has to be
 * registered for every origin the app is served from. That last one is the
 * usual reason device login fails while desktop works.
 */

import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiTokens, deviceAuthRequests } from "@/lib/db/schema";
import {
  API_TOKEN_TTL_MS,
  DEVICE_CODE_TTL_MS,
  DEVICE_POLL_INTERVAL_SECONDS,
  generateBearerToken,
  generateUserCode,
  hashToken,
  isPairingLive,
  normalizeUserCode,
} from "@/lib/tokens";

export type StartedPairing = {
  /** Secret. Held only by the app and used to poll for the token. */
  deviceCode: string;
  /** Shown to the person. Short, readable, typed into the browser. */
  userCode: string;
  verificationUri: string;
  /** Same page with the code pre-filled, for a QR code or a deep link. */
  verificationUriComplete: string;
  expiresAt: string;
  intervalSeconds: number;
};

/**
 * Drops pairings that are past their expiry, so the table does not grow
 * without bound. Run opportunistically when a new pairing starts rather than
 * on a schedule: there is nothing here worth a cron job.
 *
 * Expiry alone is the condition. Denied and consumed rows are deliberately
 * left until they expire, so a client polling one gets a straight answer
 * ("denied", "expired") instead of an indistinguishable "unknown code".
 */
async function sweepExpired(): Promise<void> {
  await db
    .delete(deviceAuthRequests)
    .where(lt(deviceAuthRequests.expiresAt, new Date()));
}

/**
 * Opens a pairing.
 *
 * Retries on a user-code collision rather than trusting one draw: the code
 * space is 31^8, so a collision is vanishingly unlikely, but the column is
 * UNIQUE and an insert failing because someone got unlucky would surface as a
 * 500 on a brand new phone.
 */
export async function startPairing(
  baseUrl: string,
  deviceName: string | null,
): Promise<StartedPairing> {
  await sweepExpired();

  const deviceCode = generateBearerToken();
  const deviceCodeHash = await hashToken(deviceCode);
  const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_MS);

  let userCode: string | null = null;
  for (let attempt = 0; attempt < 5 && !userCode; attempt += 1) {
    const candidate = generateUserCode();
    const [clash] = await db
      .select({ id: deviceAuthRequests.id })
      .from(deviceAuthRequests)
      .where(eq(deviceAuthRequests.userCode, candidate))
      .limit(1);

    if (!clash) userCode = candidate;
  }

  if (!userCode) {
    throw new Error("Could not allocate a free pairing code");
  }

  await db.insert(deviceAuthRequests).values({
    deviceCodeHash,
    userCode,
    deviceName: deviceName?.slice(0, 80) ?? null,
    expiresAt,
  });

  const verificationUri = new URL("/link", baseUrl).toString();
  const complete = new URL("/link", baseUrl);
  complete.searchParams.set("code", userCode);

  return {
    deviceCode,
    userCode,
    verificationUri,
    verificationUriComplete: complete.toString(),
    expiresAt: expiresAt.toISOString(),
    intervalSeconds: DEVICE_POLL_INTERVAL_SECONDS,
  };
}

export type PendingPairing = {
  id: string;
  userCode: string;
  deviceName: string | null;
  expiresAt: Date;
};

/** Looks up a pairing by the code someone typed, or null. */
export async function findPairing(
  rawUserCode: string,
): Promise<PendingPairing | null> {
  const userCode = normalizeUserCode(rawUserCode);
  if (!userCode) return null;

  const [row] = await db
    .select({
      id: deviceAuthRequests.id,
      userCode: deviceAuthRequests.userCode,
      deviceName: deviceAuthRequests.deviceName,
      expiresAt: deviceAuthRequests.expiresAt,
      consumedAt: deviceAuthRequests.consumedAt,
      deniedAt: deviceAuthRequests.deniedAt,
    })
    .from(deviceAuthRequests)
    .where(eq(deviceAuthRequests.userCode, userCode))
    .limit(1);

  if (!row || !isPairingLive(row)) return null;

  return {
    id: row.id,
    userCode: row.userCode,
    deviceName: row.deviceName,
    expiresAt: row.expiresAt,
  };
}

export type ApprovalResult =
  | { ok: true; deviceName: string | null }
  | { ok: false; error: string };

/**
 * Approves a pairing on behalf of a signed-in user.
 *
 * The WHERE clause carries every precondition — still live, not already
 * approved — so two taps on the approve button cannot produce two tokens.
 * A zero-row update is reported as a stale code rather than retried.
 */
export async function approvePairing(
  rawUserCode: string,
  userId: string,
): Promise<ApprovalResult> {
  const userCode = normalizeUserCode(rawUserCode);
  if (!userCode) {
    return { ok: false, error: "That code does not look right. Check it again." };
  }

  const updated = await db
    .update(deviceAuthRequests)
    .set({ userId, approvedAt: new Date() })
    .where(
      and(
        eq(deviceAuthRequests.userCode, userCode),
        isNull(deviceAuthRequests.approvedAt),
        isNull(deviceAuthRequests.consumedAt),
        isNull(deviceAuthRequests.deniedAt),
      ),
    )
    .returning({ deviceName: deviceAuthRequests.deviceName, expiresAt: deviceAuthRequests.expiresAt });

  const row = updated[0];
  if (!row) {
    return {
      ok: false,
      error: "That code has expired or was already used. Start again on the app.",
    };
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    return { ok: false, error: "That code has expired. Start again on the app." };
  }

  return { ok: true, deviceName: row.deviceName };
}

export async function denyPairing(
  rawUserCode: string,
): Promise<{ ok: boolean }> {
  const userCode = normalizeUserCode(rawUserCode);
  if (!userCode) return { ok: false };

  const updated = await db
    .update(deviceAuthRequests)
    .set({ deniedAt: new Date() })
    .where(
      and(
        eq(deviceAuthRequests.userCode, userCode),
        isNull(deviceAuthRequests.consumedAt),
        isNull(deviceAuthRequests.deniedAt),
      ),
    )
    .returning({ id: deviceAuthRequests.id });

  return { ok: updated.length > 0 };
}

export type ExchangeResult =
  | { status: "pending"; intervalSeconds: number }
  | { status: "denied" }
  | { status: "expired" }
  | { status: "unknown" }
  | { status: "approved"; token: string; expiresAt: string };

/**
 * Exchanges an approved pairing for a bearer token. Single use.
 *
 * The pairing is stamped `consumedAt` in the same conditional update that
 * claims it, so a client polling twice in flight cannot mint two tokens from
 * one approval.
 */
export async function exchangePairing(
  deviceCode: string,
): Promise<ExchangeResult> {
  const deviceCodeHash = await hashToken(deviceCode);

  const [row] = await db
    .select({
      id: deviceAuthRequests.id,
      userId: deviceAuthRequests.userId,
      deviceName: deviceAuthRequests.deviceName,
      approvedAt: deviceAuthRequests.approvedAt,
      consumedAt: deviceAuthRequests.consumedAt,
      deniedAt: deviceAuthRequests.deniedAt,
      expiresAt: deviceAuthRequests.expiresAt,
    })
    .from(deviceAuthRequests)
    .where(eq(deviceAuthRequests.deviceCodeHash, deviceCodeHash))
    .limit(1);

  if (!row) return { status: "unknown" };
  if (row.deniedAt) return { status: "denied" };
  if (row.consumedAt) return { status: "expired" };
  if (row.expiresAt.getTime() <= Date.now()) return { status: "expired" };
  if (!row.approvedAt || !row.userId) {
    return { status: "pending", intervalSeconds: DEVICE_POLL_INTERVAL_SECONDS };
  }

  // Claim it. A second poll that races this one finds consumedAt already set
  // and gets "expired" rather than a second token.
  const claimed = await db
    .update(deviceAuthRequests)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(deviceAuthRequests.id, row.id),
        isNull(deviceAuthRequests.consumedAt),
      ),
    )
    .returning({ id: deviceAuthRequests.id });

  if (claimed.length === 0) return { status: "expired" };

  const token = generateBearerToken();
  const expiresAt = new Date(Date.now() + API_TOKEN_TTL_MS);

  await db.insert(apiTokens).values({
    tokenHash: await hashToken(token),
    userId: row.userId,
    deviceName: row.deviceName,
    expiresAt,
  });

  return { status: "approved", token, expiresAt: expiresAt.toISOString() };
}

/**
 * Revokes a token.
 *
 * Stamped rather than deleted, and scoped to its owner in the WHERE clause so
 * one account cannot sign another's device out.
 */
export async function revokeToken(
  userId: string,
  tokenId: string,
): Promise<boolean> {
  const updated = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiTokens.id, tokenId),
        eq(apiTokens.userId, userId),
        isNull(apiTokens.revokedAt),
      ),
    )
    .returning({ id: apiTokens.id });

  return updated.length > 0;
}

export type DeviceSession = {
  id: string;
  deviceName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
};

/** Live tokens for this user, so the web app can show and revoke them. */
export async function listDeviceSessions(
  userId: string,
): Promise<DeviceSession[]> {
  const rows = await db
    .select({
      id: apiTokens.id,
      deviceName: apiTokens.deviceName,
      createdAt: apiTokens.createdAt,
      lastUsedAt: apiTokens.lastUsedAt,
      expiresAt: apiTokens.expiresAt,
    })
    .from(apiTokens)
    .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
    .orderBy(desc(apiTokens.createdAt));

  return rows
    .filter((row) => row.expiresAt.getTime() > Date.now())
    .map((row) => ({
      id: row.id,
      deviceName: row.deviceName,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt.toISOString(),
    }));
}
