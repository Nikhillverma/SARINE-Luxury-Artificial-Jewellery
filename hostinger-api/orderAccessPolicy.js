/** Public order tokens are 32 random bytes encoded as 64 hexadecimal characters. */
export function isValidPublicOrderToken(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}
