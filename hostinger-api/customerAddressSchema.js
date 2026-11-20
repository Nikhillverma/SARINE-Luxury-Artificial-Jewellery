import { pool } from "./db.js";

let schemaReady;
export async function ensureCustomerAddressSchema() {
  if (!schemaReady) {
    schemaReady = pool.execute(
      `CREATE TABLE IF NOT EXISTS customer_addresses (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        customer_id VARCHAR(36) NOT NULL,
        full_name VARCHAR(120) NOT NULL,
        phone VARCHAR(24) NOT NULL,
        line1 VARCHAR(240) NOT NULL,
        line2 VARCHAR(240) NULL,
        city VARCHAR(100) NOT NULL,
        state VARCHAR(100) NOT NULL,
        pincode VARCHAR(6) NOT NULL,
        is_default TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        INDEX idx_customer_addresses_customer (customer_id, is_default, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ).catch(error => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}
