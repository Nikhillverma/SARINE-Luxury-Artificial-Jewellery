import { pool } from "./db.js";
let schemaPromise;
export async function ensureContactInquiriesSchema() {
  if (!schemaPromise) {
    schemaPromise = pool.execute(
      "CREATE TABLE IF NOT EXISTS contact_inquiries (" +
      "id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, " +
      "name VARCHAR(120) NOT NULL, email VARCHAR(254) NOT NULL, phone VARCHAR(24) NULL, " +
      "subject VARCHAR(160) NULL, message TEXT NOT NULL, " +
      "status ENUM('new','reviewed','closed') NOT NULL DEFAULT 'new', admin_note VARCHAR(1000) NULL, " +
      "created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), " +
      "updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), " +
      "INDEX idx_contact_inquiries_status_created (status, created_at), INDEX idx_contact_inquiries_email (email)" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    ).catch((error) => { schemaPromise = undefined; throw error; });
  }
  await schemaPromise;
}
