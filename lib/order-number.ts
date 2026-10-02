/**
 * Human-readable order numbers.
 *
 * The alphabet omits I, L, O, 0 and 1 so a number read aloud down a phone
 * line or copied off a screen cannot land on the wrong order.
 */
export const ORDER_NUMBER_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ORDER_NUMBER_PREFIX = "VS-";
export const ORDER_NUMBER_LENGTH = 6;
export const ORDER_NUMBER_PATTERN = new RegExp(
  `^${ORDER_NUMBER_PREFIX}[${ORDER_NUMBER_ALPHABET}]{${ORDER_NUMBER_LENGTH}}$`,
);

/**
 * Maps raw bytes to an order number. Separated from the random source so the
 * mapping can be tested against fixed input.
 *
 * Note the modulo is biased: 256 % 31 !== 0, so the first few letters of the
 * alphabet are marginally more likely. That is fine here — this is a
 * readability aid with a uniqueness constraint enforced by a UNIQUE index,
 * not a secret. Do not reuse this for tokens.
 */
export function orderNumberFromBytes(bytes: Uint8Array): string {
  const code = Array.from(
    bytes.slice(0, ORDER_NUMBER_LENGTH),
    (byte) => ORDER_NUMBER_ALPHABET[byte % ORDER_NUMBER_ALPHABET.length],
  ).join("");

  return `${ORDER_NUMBER_PREFIX}${code}`;
}

/** VS-7K2M4Q */
export function generateOrderNumber(): string {
  return orderNumberFromBytes(
    crypto.getRandomValues(new Uint8Array(ORDER_NUMBER_LENGTH)),
  );
}
