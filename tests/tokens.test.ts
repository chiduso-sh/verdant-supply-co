import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  encodeTokenBytes,
  formatUserCode,
  generateBearerToken,
  generateUserCode,
  hashToken,
  isPairingLive,
  isTokenLive,
  normalizeUserCode,
  parseBearer,
  USER_CODE_ALPHABET,
  USER_CODE_LENGTH,
  userCodeFromBytes,
} from "../lib/tokens";

const NOW = new Date("2026-10-07T12:00:00Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);

describe("userCodeFromBytes", () => {
  it("maps bytes to the alphabet and formats with a dash", () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
    assert.equal(userCodeFromBytes(bytes), "ABCD-EFGH");
  });

  it("returns a code of the declared length ignoring the dash", () => {
    const code = userCodeFromBytes(new Uint8Array(8).fill(0));
    assert.equal(code?.replace("-", "").length, USER_CODE_LENGTH);
  });

  it("rejects bytes that would bias the distribution", () => {
    // 248 is the first byte at or above 31 * 8, so it must be skipped
    // entirely rather than folded back onto A (248 % 31 === 0).
    const bytes = new Uint8Array([248, 249, 255, 0, 1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(userCodeFromBytes(bytes), "ABCD-EFGH");
  });

  it("returns null when the bytes run out before the code is full", () => {
    assert.equal(userCodeFromBytes(new Uint8Array([0, 1, 2])), null);
  });

  it("returns null when every byte is rejected", () => {
    assert.equal(userCodeFromBytes(new Uint8Array(32).fill(255)), null);
  });

  it("only ever emits characters from the alphabet", () => {
    const bytes = new Uint8Array(256).map((_, index) => index);
    const code = userCodeFromBytes(bytes)!.replace("-", "");
    assert.ok([...code].every((char) => USER_CODE_ALPHABET.includes(char)));
  });

  it("omits every confusable character from the alphabet", () => {
    for (const char of ["I", "L", "O", "0", "1"]) {
      assert.ok(
        !USER_CODE_ALPHABET.includes(char),
        `${char} should not be in the pairing alphabet`,
      );
    }
  });
});

describe("generateUserCode", () => {
  it("produces a nine-character dashed code", () => {
    assert.match(generateUserCode(), /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("does not repeat itself across many draws", () => {
    const codes = new Set(
      Array.from({ length: 200 }, () => generateUserCode()),
    );
    assert.equal(codes.size, 200);
  });
});

describe("formatUserCode", () => {
  it("inserts a dash after four characters", () => {
    assert.equal(formatUserCode("ABCDEFGH"), "ABCD-EFGH");
  });

  it("is idempotent on an already-formatted code", () => {
    assert.equal(formatUserCode("ABCD-EFGH"), "ABCD-EFGH");
  });
});

describe("normalizeUserCode", () => {
  it("accepts the canonical form unchanged", () => {
    assert.equal(normalizeUserCode("ABCD-EFGH"), "ABCD-EFGH");
  });

  it("accepts a code with no dash", () => {
    assert.equal(normalizeUserCode("ABCDEFGH"), "ABCD-EFGH");
  });

  it("upper-cases what was typed", () => {
    assert.equal(normalizeUserCode("abcd-efgh"), "ABCD-EFGH");
  });

  it("ignores spaces and stray separators", () => {
    assert.equal(normalizeUserCode("  ab cd _ ef-gh "), "ABCD-EFGH");
  });

  it("rejects a confusable character rather than guessing", () => {
    // O is not in the alphabet, and neither is 0, so there is no correct
    // letter to fold onto. Approving a different pairing would be worse.
    const bad = [
      "ABCD-EFGO",
      "ABCD-EFG0",
      "ABCD-EFGI",
      "ABCD-EFG1",
      "ABCD-EFGL",
    ];
    for (const code of bad) {
      assert.equal(normalizeUserCode(code), null, `${code} should be rejected`);
    }
  });

  it("rejects a code of the wrong length", () => {
    assert.equal(normalizeUserCode("ABCD-EFG"), null);
    assert.equal(normalizeUserCode("ABCD-EFGHJ"), null);
    assert.equal(normalizeUserCode(""), null);
  });

  it("round-trips a freshly generated code", () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const code = generateUserCode();
      assert.equal(normalizeUserCode(code.toLowerCase()), code);
    }
  });
});

describe("encodeTokenBytes", () => {
  it("encodes as base64url with no padding", () => {
    assert.equal(encodeTokenBytes(new Uint8Array([251, 255, 190])), "-_--");
  });

  it("never emits a character that needs URL escaping", () => {
    const encoded = encodeTokenBytes(
      new Uint8Array(256).map((_, index) => index),
    );
    assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  });
});

describe("generateBearerToken", () => {
  it("is URL-safe and long enough to be unguessable", () => {
    const token = generateBearerToken();
    assert.match(token, /^[A-Za-z0-9_-]+$/);
    // 32 bytes of base64url, unpadded.
    assert.equal(token.length, 43);
  });

  it("does not repeat itself", () => {
    const tokens = new Set(
      Array.from({ length: 200 }, () => generateBearerToken()),
    );
    assert.equal(tokens.size, 200);
  });
});

describe("hashToken", () => {
  it("matches the known SHA-256 of a fixed input", async () => {
    assert.equal(
      await hashToken("abc"),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("is 64 hex characters", async () => {
    assert.match(await hashToken(generateBearerToken()), /^[0-9a-f]{64}$/);
  });

  it("is stable across calls", async () => {
    const token = generateBearerToken();
    assert.equal(await hashToken(token), await hashToken(token));
  });

  it("differs for different tokens", async () => {
    assert.notEqual(await hashToken("a"), await hashToken("b"));
  });

  it("never returns the token itself", async () => {
    const token = generateBearerToken();
    assert.notEqual(await hashToken(token), token);
  });
});

describe("parseBearer", () => {
  it("extracts the token", () => {
    assert.equal(parseBearer("Bearer abc123"), "abc123");
  });

  it("is case-insensitive about the scheme", () => {
    assert.equal(parseBearer("bearer abc123"), "abc123");
    assert.equal(parseBearer("BEARER abc123"), "abc123");
  });

  it("tolerates extra whitespace around the header", () => {
    assert.equal(parseBearer("  Bearer   abc123  "), "abc123");
  });

  it("returns null for a missing header", () => {
    assert.equal(parseBearer(null), null);
  });

  it("returns null for a bare token with no scheme", () => {
    assert.equal(parseBearer("abc123"), null);
  });

  it("returns null for another scheme", () => {
    assert.equal(parseBearer("Basic abc123"), null);
  });

  it("returns null for a scheme with no token", () => {
    assert.equal(parseBearer("Bearer"), null);
    assert.equal(parseBearer("Bearer   "), null);
  });

  it("returns null when the token contains a space", () => {
    assert.equal(parseBearer("Bearer abc 123"), null);
  });
});

describe("isTokenLive", () => {
  it("is true for an unexpired, unrevoked token", () => {
    assert.equal(
      isTokenLive({ expiresAt: later(1000), revokedAt: null }, NOW),
      true,
    );
  });

  it("is false once expired", () => {
    assert.equal(
      isTokenLive({ expiresAt: later(-1000), revokedAt: null }, NOW),
      false,
    );
  });

  it("is false exactly at the expiry instant", () => {
    assert.equal(isTokenLive({ expiresAt: NOW, revokedAt: null }, NOW), false);
  });

  it("is false when revoked, even if unexpired", () => {
    assert.equal(
      isTokenLive({ expiresAt: later(1000), revokedAt: later(-10) }, NOW),
      false,
    );
  });
});

describe("isPairingLive", () => {
  const base = { expiresAt: later(1000), consumedAt: null, deniedAt: null };

  it("is true for a fresh pairing", () => {
    assert.equal(isPairingLive(base, NOW), true);
  });

  it("is false once expired", () => {
    assert.equal(isPairingLive({ ...base, expiresAt: later(-1) }, NOW), false);
  });

  it("is false once exchanged, so a pairing is single-use", () => {
    assert.equal(isPairingLive({ ...base, consumedAt: NOW }, NOW), false);
  });

  it("is false once denied", () => {
    assert.equal(isPairingLive({ ...base, deniedAt: NOW }, NOW), false);
  });
});
