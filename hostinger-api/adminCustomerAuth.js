import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";

const router = Router();
router.use(requireAdminAuth);

router.get("/status", async (_req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    return res.json({
      emailOtp: { provider: "Resend", configured: Boolean(process.env.RESEND_API_KEY && process.env.SARINE_EMAIL_FROM) },
      phoneOtp: { provider: "MSG91", configured: Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID) },
      google: { provider: "Google Identity Services", configured: Boolean(process.env.GOOGLE_CLIENT_ID) },
      otpSecurity: { secretConfigured: Boolean(process.env.CUSTOMER_OTP_SECRET && process.env.CUSTOMER_OTP_SECRET.length >= 32) }
    });
  } catch (error) { return next(error); }
});

router.get("/delivery-events", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const limitValue = Number.parseInt(String(req.query.limit || "50"), 10);
    const limit = Number.isInteger(limitValue) ? Math.min(Math.max(limitValue, 1), 100) : 50;
    const [events] = await pool.execute(
      "SELECT id, challenge_id, method, purpose, provider, identifier_masked, status, failure_code, created_at FROM customer_auth_delivery_events ORDER BY id DESC LIMIT ?",
      [limit]
    );
    const [summary] = await pool.execute(
      "SELECT COUNT(*) AS total, SUM(status = 'sent') AS sent, SUM(status = 'failed') AS failed FROM customer_auth_delivery_events WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 24 HOUR)"
    );
    return res.json({
      events: events.map(event => ({ ...event, id: Number(event.id), createdAt: event.created_at ? new Date(event.created_at).toISOString() : null })),
      last24Hours: {
        total: Number(summary[0]?.total) || 0,
        sent: Number(summary[0]?.sent) || 0,
        failed: Number(summary[0]?.failed) || 0
      }
    });
  } catch (error) { return next(error); }
});

router.get("/security", async (_req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const [challenges] = await pool.execute(
      "SELECT method, purpose, COUNT(*) AS total, SUM(attempts) AS incorrectAttempts FROM customer_auth_challenges WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 24 HOUR) GROUP BY method, purpose"
    );
    const [expired] = await pool.execute(
      "SELECT COUNT(*) AS total FROM customer_auth_challenges WHERE expires_at <= UTC_TIMESTAMP(3) AND consumed_at IS NULL"
    );
    return res.json({
      last24Hours: challenges.map(row => ({ method: row.method, purpose: row.purpose, total: Number(row.total) || 0, incorrectAttempts: Number(row.incorrectAttempts) || 0 })),
      expiredUnconsumedChallenges: Number(expired[0]?.total) || 0
    });
  } catch (error) { return next(error); }
});

export default router;
