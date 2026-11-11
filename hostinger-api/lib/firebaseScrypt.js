import {
  createCipheriv,
  scrypt as scryptCallback,
  timingSafeEqual
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const MAX_MEM_COST = 14;
const MAX_ROUNDS = 8;

function decodeBase64(value, label) {
  if (typeof value !== "string" || value.length === 0 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new TypeError(`Invalid base64 value for ${label}`);
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.length === 0) throw new TypeError(`Empty decoded value for ${label}`);
  return decoded;
}

function validateConfig(config) {
  if (!config || !Number.isInteger(config.memCost) ||
      config.memCost < 1 || config.memCost > MAX_MEM_COST) {
    throw new TypeError("Firebase SCRYPT memCost must be an integer from 1 to 14");
  }
  if (!Number.isInteger(config.rounds) ||
      config.rounds < 1 || config.rounds > MAX_ROUNDS) {
    throw new TypeError("Firebase SCRYPT rounds must be an integer from 1 to 8");
  }
  return {
    memCost: config.memCost,
    rounds: config.rounds,
    signerKey: decodeBase64(config.signerKey, "signerKey"),
    saltSeparator: config.saltSeparator === undefined
      ? Buffer.alloc(0)
      : decodeBase64(config.saltSeparator, "saltSeparator")
  };
}

/**
 * Verify Firebase Authentication's modified SCRYPT export format.
 * The signer key and salt separator must be supplied from protected runtime
 * configuration; never persist them in source control or account rows.
 */
export async function verifyFirebaseScrypt({
  password,
  passwordHash,
  passwordSalt,
  config
}) {
  if (typeof password !== "string" || password.length === 0 || password.length > 4096) {
    return false;
  }

  let settings;
  let expected;
  let salt;
  try {
    settings = validateConfig(config);
    expected = decodeBase64(passwordHash, "passwordHash");
    salt = decodeBase64(passwordSalt, "passwordSalt");
  } catch {
    return false;
  }

  if (expected.length !== settings.signerKey.length) return false;

  const combinedSalt = Buffer.concat([salt, settings.saltSeparator]);
  const derivedKey = await scrypt(password, combinedSalt, KEY_LENGTH, {
    N: 2 ** settings.memCost,
    r: settings.rounds,
    p: 1,
    maxmem: 64 * 1024 * 1024
  });

  const iv = Buffer.alloc(IV_LENGTH, 0);
  const cipher = createCipheriv("aes-256-ctr", derivedKey, iv);
  const actual = Buffer.concat([
    cipher.update(settings.signerKey),
    cipher.final()
  ]);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
