import express, { Router } from "express";
import {
  buildRazorpayWebhookRecord,
  getRazorpayWebhookEventStatus,
  markRazorpayWebhookEventStatus,
  storeRazorpayWebhookEvent,
  verifyRazorpayWebhookSignature
} from "./razorpayWebhookPolicy.js";
import { applyGatewayRefundEvent } from "./refundLedger.js";

const router = Router();

// Log delivery metadata only. Never log webhook bodies, signatures, or secrets.
// This makes successful deliveries and rejected requests visible in Hostinger logs.
router.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    console.info("[razorpay.webhook] request", JSON.stringify({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      contentType: req.get("content-type") || null,
      hasSignatureHeader: Boolean(req.get("x-razorpay-signature")),
      hasEventIdHeader: Boolean(req.get("x-razorpay-event-id"))
    }));
  });
  next();
});

// Razorpay sends POST requests. A GET response makes endpoint reachability
// explicit without accepting or processing an unsigned payload.
router.get("/razorpay", (_req, res) => {
  res.set("Allow", "POST");
  return res.status(405).json({
    error: "Razorpay webhook endpoint is reachable; POST is required."
  });
});

router.post(
  "/razorpay",
  express.raw({ type: ["application/json", "application/*+json"], limit: "1mb" }),
  async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      return res.status(503).json({ error: "Razorpay webhook receiver is not configured." });
    }

    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
      return res.status(415).json({ error: "Expected a raw JSON webhook payload." });
    }

    const signature = req.get("x-razorpay-signature") || "";
    if (!verifyRazorpayWebhookSignature(rawBody, signature, secret)) {
      return res.status(401).json({ error: "Invalid webhook signature." });
    }

    const eventId = req.get("x-razorpay-event-id") || "";
    if (!eventId) {
      return res.status(400).json({ error: "Missing Razorpay event ID." });
    }

    try {
      let payload;
      try {
        payload = JSON.parse(rawBody.toString("utf8"));
      } catch {
        return res.status(400).json({ error: "Invalid JSON webhook payload." });
      }

      const record = buildRazorpayWebhookRecord(eventId, payload);
      const result = await storeRazorpayWebhookEvent(record);
      let refundMatched = null;

      if (record.eventType.startsWith("refund.")) {
        const currentEventStatus = result.inserted
          ? "received"
          : await getRazorpayWebhookEventStatus(record.eventId);

        if (currentEventStatus === "received") {
          // A failed database processing attempt remains retryable; a handled
          // event is not replayed later and cannot overwrite a newer outcome.
          refundMatched = await applyGatewayRefundEvent(record);
          const handled = Boolean(refundMatched?.matched) &&
            refundMatched?.status !== "awaiting_verified_status" &&
            !refundMatched?.mismatch;
          await markRazorpayWebhookEventStatus(record.eventId, handled ? "processed" : "needs_review");
        } else {
          refundMatched = { matched: currentEventStatus === "processed" };
        }
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
  }
);

export default router;
