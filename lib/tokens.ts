/**
 * Credential material for the mobile client: bearer tokens and the short
 * codes used to pair a device.
 *
 * Pure except for the two functions that explicitly ask the platform for
 * randomness or a digest, both of which take their input injectably so the
 * mapping can be tested against fixed bytes.
 *
 * Note this does NOT reuse `orderNumberFromBytes` from lib/order-number.ts.
 * That mapping is documented as modulo-biased, which is harmless for a
 * human-readable order reference backed by a UNIQUE index and not harmless at
 * all for something an attacker would like to guess. The sampling here
 * rejects out-of-range bytes instead.
 */

/** No I, L, O, 0 or 1: a pairing code gets read off one screen and typed into another. */
export const USER_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const USER_CODE_LENGTH = 8;
/** Largest multiple of the alphabet length that fits in a byte (31 * 8). */
const USER_CODE_ACCEPT_BELOW =
  USER_CODE_ALPHABET.length * Math.floor(256 / USER_CODE_ALPHABET.length);

export const BEARER_TOKEN_BYTES = 32;
/** Pairings are approved in the next minute or two, never tomorrow. */
export const DEVICE_CODE_TTL_MS = 10 * 60 * 1000;
/** Long-lived on purpose: re-pairing a phone every week is not a feature. */
export const API_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
/** How often the app should poll while waiting for approval, in seconds. */
export const DEVICE_POLL_INTERVAL_SECONDS = 2;

/**
 * Maps raw bytes to a pairing code, rejecting any byte that would skew the
 * distribution. Separated from the random source so it can be tested.
 *
 * Returns null when `bytes` runs out before the code is full — callers draw
 * generously and retry rather than padding with a biased fallback.
 */
export function userCodeFromBytes(bytes: Uint8Array): string | null {
  let code = "";

  for (const byte of bytes) {
    if (byte >= USER_CODE_ACCEPT_BELOW) continue;
    code += USER_CODE_ALPHABET[byte % USER_CODE_ALPHABET.length];
    if (code.length === USER_CODE_LENGTH) return formatUserCode(code);
  }

  return null;
}

/** ABCD-EFGH. The dash is cosmetic and stripped on the way back in. */
export function formatUserCode(code: string): string {
  const bare = code.replace(/-/g, "");
  return `${bare.slice(0, 4)}-${bare.slice(4)}`;
}

export function generateUserCode(): string {
  // 64 bytes against 8 needed: the chance of rejecting enough of them to come
  // up short is far below anything worth a retry loop, but assert it anyway.
  const code = userCodeFromBytes(crypto.getRandomValues(new Uint8Array(64)));
  if (!code) throw new Error("Ran out of entropy generating a pairing code");
  return code;
}

/**
 * Canonicalizes what someone typed into the approval form.
 *
 * Lowercase, stray spaces and a missing dash are all expected and forgiven.
 * A character outside the alphabet is not: since the alphabet omits both O
 * and 0 (and both I and 1, and L), a misread has no correct letter to fold
 * onto, and guessing one would approve a *different* pairing than the one on
 * screen. Rejecting sends the user back to re-read eight characters, which is
 * the cheaper mistake.
 */
export function normalizeUserCode(input: string): string | null {
  const bare = input.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (bare.length !== USER_CODE_LENGTH) return null;
  if (![...bare].every((char) => USER_CODE_ALPHABET.includes(char))) {
    return null;
  }

  return formatUserCode(bare);
}

/** URL-safe, no padding: this ends up in an Authorization header. */
export function encodeTokenBytes(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function generateBearerToken(): string {
  return encodeTokenBytes(
    crypto.getRandomValues(new Uint8Array(BEARER_TOKEN_BYTES)),
  );
}

/**
 * SHA-256, hex. Only the hash is ever stored, so a database dump yields
 * nothing usable; lookups are by hash against a UNIQUE index, which is also
 * why no constant-time comparison is needed here.
 */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Pulls the token out of an `Authorization: Bearer <token>` header.
 *
 * Returns null for anything else, including a bare token with no scheme: a
 * client that gets the header shape wrong should fail loudly at the edge
 * rather than have its mistake papered over.
 */
export function parseBearer(header: string | null): string | null {
  if (!header) return null;

  const match = /^Bearer[ ]+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/** True when a token row is still usable right now. */
export function isTokenLive(
  row: { expiresAt: Date; revokedAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (row.revokedAt) return false;
  return row.expiresAt.getTime() > now.getTime();
}

/** True when a pairing can still be approved or exchanged. */
export function isPairingLive(
  row: {
    expiresAt: Date;
    consumedAt: Date | null;
    deniedAt: Date | null;
  },
  now: Date = new Date(),
): boolean {
  if (row.consumedAt || row.deniedAt) return false;
  return row.expiresAt.getTime() > now.getTime();
}
