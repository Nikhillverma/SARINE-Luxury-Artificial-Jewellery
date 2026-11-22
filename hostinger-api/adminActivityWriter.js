import { pool } from "./db.js";

function cleanText(value, maxLength = 500) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).replace(/[\\u0000-\\u001f\\u007f]/g, " ").trim().slice(0, maxLength);
}

export async function recordAdminActivity(admin, event) {
  try {
    await pool.execute(
      `INSERT INTO admin_activity_logs
       (admin_id, admin_name, admin_email, action, entity_type, entity_id,
        summary, http_method, route, status_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanText(admin?.id, 64),
        cleanText(admin?.name || admin?.email, 160),
        cleanText(admin?.email, 254),
        cleanText(event?.action, 100),
        cleanText(event?.entityType || "admin", 80),
        cleanText(event?.entityId, 190) || null,
        cleanText(event?.summary, 500),
        cleanText(event?.method || "POST", 10),
        cleanText(event?.route || "/auth", 255),
        Math.max(200, Math.min(599, Number(event?.statusCode) || 200))
      ]
    );
  } catch (error) {
    console.error("Admin activity audit write failed:", error.message);
  }
}
