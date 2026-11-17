import crypto from "node:crypto";

export const CUSTOMER_OTP_POLICY = Object.freeze({
  ttlMinutes: 5,
  resendCooldownSeconds: 45,
  maxAttempts: 5
});

export function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const local = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : "";
}

export function createOtp() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtp(challengeId, otp, secret = process.env.CUSTOMER_OTP_SECRET) {
  if (!secret || secret.length < 32) throw new Error("CUSTOMER_OTP_SECRET must be configured with at least 32 characters.");
  return crypto.createHmac("sha256", secret).update(`${challengeId}:${otp}`).digest("hex");
}

export function safeOtpEqual(expected, actual) {
  if (typeof expected !== "string" || typeof actual !== "string" || !/^[a-f0-9]{64}$/i.test(expected) || !/^[a-f0-9]{64}$/i.test(actual)) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
}
