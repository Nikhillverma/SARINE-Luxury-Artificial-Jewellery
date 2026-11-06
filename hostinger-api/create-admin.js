
import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { pool } from "./db.js";

const email = "nikhilvermav1999@gmail.com";
const password = process.env.SARINE_ADMIN_PASSWORD;

try {
  if (!password || password.length < 12) {
    throw new Error("Password must contain at least 12 characters.");
  }

  const [existing] = await pool.execute(
    "SELECT COUNT(*) AS total FROM admins"
  );

  if (Number(existing[0].total) > 0) {
    throw new Error(
      "An admin account already exists. No account was created."
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const id = randomUUID();

  await pool.execute(
    `INSERT INTO admins
      (id, email, email_normalized, name, password_hash, role, status,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'admin', 'active',
             CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
    [
      id,
      email,
      email,
      "SARINE Administrator",
      passwordHash
    ]
  );

  console.log("SARINE admin account created successfully.");
  console.log("Admin email:", email);
} catch (error) {
  console.error("Admin creation failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
