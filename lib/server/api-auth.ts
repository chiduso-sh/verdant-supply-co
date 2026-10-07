/**
 * Who is calling an /api route.
 *
 * Two credentials resolve to the same thing. The web app sends Auth.js's
 * HTTP-only session cookie; a native app cannot hold one, so it sends a
 * bearer token from the `api_token` table instead. Both paths end at a row in
 * `user`, which is what makes "the same account on both" literally true
 * rather than approximately true — there is no parallel user concept.
 *
 * Bearer is checked first so an explicit Authorization header always wins
 * over whatever cookie happened to ride along.
 */

import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { apiTokens, users } from "@/lib/db/schema";
import { hashToken, isTokenLive, parseBearer } from "@/lib/tokens";

export type ApiCaller = {
  userId: string;
  email: string | null;
  name: string | null;
  /** Which credential was used. Only for logging and the /api/me response. */
  via: "bearer" | "cookie";
  /** Present only for bearer callers, so sign-out can revoke this token. */
  tokenId?: string;
};

/**
 * How stale `lastUsedAt` is allowed to get before it is worth a write.
 *
 * Without this, every single API call costs an extra UPDATE. The column only
 * exists so a human can tell a live device from an abandoned one, and five
 * minutes of resolution is plenty for that.
 */
const LAST_USED_WRITE_INTERVAL_MS = 5 * 60 * 1000;

async function callerFromBearer(
  request: Request,
): Promise<ApiCaller | null> {
  const token = parseBearer(request.headers.get("authorization"));
  if (!token) return null;

  // Looked up by hash: the plaintext token is never stored, so a database
  // dump yields nothing usable, and the UNIQUE index on token_hash makes the
  // comparison a single indexed probe.
  const [row] = await db
    .select({
      tokenId: apiTokens.id,
      userId: apiTokens.userId,
      expiresAt: apiTokens.expiresAt,
      revokedAt: apiTokens.revokedAt,
      lastUsedAt: apiTokens.lastUsedAt,
      email: users.email,
      name: users.name,
    })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.userId))
    .where(eq(apiTokens.tokenHash, await hashToken(token)))
    .limit(1);

  if (!row || !isTokenLive(row)) return null;

  const now = Date.now();
  const stale =
    !row.lastUsedAt ||
    now - row.lastUsedAt.getTime() > LAST_USED_WRITE_INTERVAL_MS;

  if (stale) {
    // Deliberately not awaited into the critical path's result, but awaited
    // all the same: a serverless function that returns before its floating
    // promise settles will have the write cancelled mid-flight.
    await db
      .update(apiTokens)
      .set({ lastUsedAt: new Date(now) })
      .where(eq(apiTokens.id, row.tokenId));
  }

  return {
    userId: row.userId,
    email: row.email,
    name: row.name,
    via: "bearer",
    tokenId: row.tokenId,
  };
}

async function callerFromCookie(): Promise<ApiCaller | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    via: "cookie",
  };
}

/** Returns the caller, or null when neither credential checks out. */
export async function resolveCaller(
  request: Request,
): Promise<ApiCaller | null> {
  return (await callerFromBearer(request)) ?? (await callerFromCookie());
}
