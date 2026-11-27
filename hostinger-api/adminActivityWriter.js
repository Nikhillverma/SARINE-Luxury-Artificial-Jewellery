import { pool } from "./db.js";

function cleanText(value, maxLength = 500) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength);
}

export async function recordAdminActivity(admin, event) {
  const values = [
    cleanText(admin?.id || "unknown", 64),
    cleanText(admin?.name || admin?.email || "Unknown administrator", 160),
    cleanText(admin?.email || "unavailable", 254),
    cleanText(event?.action, 100),
    cleanText(event?.entityType || "admin", 80),
    cleanText(event?.entityId, 190) || null,
    cleanText(event?.summary, 500),
    cleanText(event?.method || "POST", 10),
    cleanText(event?.route || "/auth", 255),
    Math.max(200, Math.min(599, Number(event?.statusCode) || 200))
  ];

  // A short bounded retry helps transient connection/lock failures without
  // delaying the admin response indefinitely or storing sensitive request data.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await pool.execute(
        `INSERT INTO admin_activity_logs
         (admin_id, admin_name, admin_email, action, entity_type, entity_id,
          summary, http_method, route, status_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values
      );
      return true;
    } catch (error) {
      if (attempt === 2) {
        console.error("Admin activity audit write failed after retry:", error.message);
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }
  return false;
}
