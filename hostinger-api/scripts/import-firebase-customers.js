import fs from "node:fs/promises";
import crypto from "node:crypto";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function readUsers(exportData) {
  if (Array.isArray(exportData)) return exportData;
  if (Array.isArray(exportData?.users)) return exportData.users;
  throw new Error("Unsupported Firebase Auth export: expected a users array.");
}

let pool;

async function main() {
  const exportPath = process.env.FIREBASE_AUTH_EXPORT_PATH;
  if (!exportPath) throw new Error("Set FIREBASE_AUTH_EXPORT_PATH to the local Firebase Auth export JSON path.");
  const raw = await fs.readFile(exportPath, "utf8");
  const users = readUsers(JSON.parse(raw));
  const apply = process.argv.includes("--apply");
  if (apply && (!process.env.FIREBASE_SCRYPT_SIGNER_KEY ||
      !process.env.FIREBASE_SCRYPT_SALT_SEPARATOR ||
      !process.env.FIREBASE_SCRYPT_MEM_COST || !process.env.FIREBASE_SCRYPT_ROUNDS)) {
    throw new Error("Refusing import: Firebase SCRYPT runtime configuration is incomplete.");
  }
  if (apply) {
    const database = await import("../db.js");
    pool = database.pool;
  }
  let imported = 0;
  let skipped = 0;
  let passwordAccounts = 0;
  let disabledAccounts = 0;

  for (const user of users) {
    const uid = String(user.localId || user.uid || "").trim();
    const email = normalizeEmail(user.email);
    if (!uid || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skipped++;
      continue;
    }

    const passwordHash = typeof user.passwordHash === "string" && user.passwordHash
      ? user.passwordHash : null;
    const passwordSalt = typeof user.salt === "string" && user.salt
      ? user.salt : null;
    if (Boolean(passwordHash) !== Boolean(passwordSalt)) {
      throw new Error(`Refusing incomplete password hash/salt for Firebase UID ${uid}.`);
    }

    if (passwordHash) passwordAccounts++;
    if (user.disabled === true) disabledAccounts++;
    const status = user.disabled === true ? "disabled" : (passwordHash ? "active" : "pending");
    const name = String(user.displayName || email.split("@")[0]).trim().slice(0, 255) || email;
    const phone = typeof user.phoneNumber === "string" && user.phoneNumber.trim()
      ? user.phoneNumber.trim().slice(0, 32) : null;
    const verifiedAt = user.emailVerified === true
      ? (parseDate(user.lastLoginAt) || parseDate(user.createdAt) || new Date())
      : null;

    if (!apply) {
      imported++;
      continue;
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [byUid] = await connection.execute(
        "SELECT id FROM customers WHERE legacy_firebase_uid = ? LIMIT 1 FOR UPDATE",
        [uid]
      );
      const [byEmail] = await connection.execute(
        "SELECT id FROM customers WHERE email_normalized = ? LIMIT 1 FOR UPDATE",
        [email]
      );

      // Never overwrite an existing account or silently join two identities.
      if (byUid.length || byEmail.length) {
        await connection.rollback();
        skipped++;
        continue;
      }

      const id = crypto.randomUUID();
      await connection.execute(
        `INSERT INTO customers
         (id, email, email_normalized, name, phone, password_hash, password_salt,
          password_scheme, email_verified_at, status, legacy_firebase_uid,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP(3)), CURRENT_TIMESTAMP(3))`,
        [
          id, email, email, name, phone, passwordHash, passwordSalt,
          passwordHash ? "firebase_scrypt" : "none",
          verifiedAt, status, uid, parseDate(user.createdAt)
        ]
      );
      await connection.commit();
      imported++;
    } catch (error) {
      await connection.rollback();
      if (error.code === "ER_DUP_ENTRY") {
        skipped++;
      } else {
        throw error;
      }
    } finally {
      connection.release();
    }
  }

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", total: users.length, validAccounts: imported + skipped, passwordAccounts, disabledAccounts, imported: apply ? imported : 0, skipped }));
  if (pool) await pool.end();
}

main().catch(async error => {
  console.error("Customer import stopped:", error.message);
  try { if (pool) await pool.end(); } catch {}
  process.exitCode = 1;
});
