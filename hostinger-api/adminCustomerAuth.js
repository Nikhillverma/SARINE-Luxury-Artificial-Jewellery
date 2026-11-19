import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";
import { ensureCustomerOtpSchema, getCustomerOtpAvailability } from "./customerOtpService.js";

const router = Router();
router.use(requireAdminAuth);

router.get("/status", async (_req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    return res.json({
      emailOtp: {
        ...getCustomerOtpAvailability().email,
        configured: getCustomerOtpAvailability().email.enabled,
        template: process.env.MSG91_EMAIL_TEMPLATE_ID || "global_otp"
      },
      phoneOtp: {
        provider: "MSG91",
        enabled: false,
        configured: false,
        reason: "Phone OTP delivery remains disabled until the MSG91 SMS route, sender/template approval and costs are explicitly confirmed."
      },
      google: { provider: "Google Identity Services", configured: Boolean(process.env.GOOGLE_CLIENT_ID) },
      otpSecurity: { secretConfigured: Boolean(process.env.CUSTOMER_OTP_SECRET && process.env.CUSTOMER_OTP_SECRET.length >= 32) }
    });
  } catch (error) { return next(error); }
});

router.get("/delivery-events", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    await ensureCustomerOtpSchema();
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
    await ensureCustomerOtpSchema();
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
