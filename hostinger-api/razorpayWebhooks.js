import { Router } from "express";
import {
  buildRazorpayWebhookRecord,
  storeRazorpayWebhookEvent,
  verifyRazorpayWebhookSignature
} from "./razorpayWebhookPolicy.js";
import { applyGatewayRefundEvent } from "./refundLedger.js";

const router = Router();

// Razorpay signs the original request bytes. server.js captures them in
// express.json({ verify }) before this route is mounted.
router.post("/razorpay", async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(503).json({ error: "Razorpay webhook receiver is not configured." });
  }
  const signature = req.get("x-razorpay-signature") || "";
  if (!verifyRazorpayWebhookSignature(req.rawBody, signature, secret)) {
    return res.status(401).json({ error: "Invalid webhook signature." });
  }

  const eventId = req.get("x-razorpay-event-id") || "";
  if (!eventId) {
    return res.status(400).json({ error: "Missing Razorpay event ID." });
  }

  try {
    const record = buildRazorpayWebhookRecord(eventId, req.body);
    const result = await storeRazorpayWebhookEvent(record);
    let refundMatched = null;
    if (record.eventType.startsWith("refund.")) {
      // Apply refund outcomes idempotently. Replays are safe and can recover
      // a webhook whose first delivery arrived before the API response save.
      refundMatched = await applyGatewayRefundEvent(record);
    }
    return res.status(200).json({
      received: true,
      duplicate: !result.inserted,
      refundMatched: refundMatched?.matched ?? null
    });
  } catch (error) {
    console.error("[razorpay.webhook] Durable event intake failed:", error.message);
    return res.status(500).json({ error: "Webhook event could not be safely recorded." });
  }
});

export default router;
