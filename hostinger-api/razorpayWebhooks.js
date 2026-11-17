import express, { Router } from "express";
import Razorpay from "razorpay";
import { pool } from "./db.js";
import { ensureInventoryTable } from "./inventoryLedger.js";
import { ensureProductVariantSchema } from "./productVariantSchema.js";
import { ensurePaymentEventLogTable } from "./paymentEventPolicy.js";
import { matchesOrderRazorpayId } from "./paymentValidation.js";
import { settleCapturedPayment } from "./paymentSettlement.js";
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

      if (record.eventType === "payment.captured") {
        const currentEventStatus = result.inserted
          ? "received"
          : await getRazorpayWebhookEventStatus(record.eventId);

        if (currentEventStatus !== "received") {
          return res.status(200).json({
            received: true,
            duplicate: true,
            paymentSettlement: currentEventStatus
          });
        }

        if (!record.gatewayOrderId || !record.gatewayPaymentId ||
            !Number.isSafeInteger(record.amountPaise) || record.amountPaise <= 0) {
          await markRazorpayWebhookEventStatus(record.eventId, "needs_review");
          return res.status(200).json({ received: true, needsReview: true, reason: "incomplete_payment_reference" });
        }

        const key_id = process.env.RAZORPAY_KEY_ID;
        const key_secret = process.env.RAZORPAY_KEY_SECRET;
        if (!key_id || !key_secret) {
          // Leave the durable event in "received" so Razorpay can retry after
          // the gateway credentials are corrected.
          return res.status(503).json({ error: "Razorpay API credentials are not configured." });
        }

        // Never trust the webhook body alone for settlement. Fetch the payment
        // independently from Razorpay and compare all gateway references.
        const razorpay = new Razorpay({ key_id, key_secret });
        const paymentRecord = await razorpay.payments.fetch(record.gatewayPaymentId);
        if (!paymentRecord ||
            paymentRecord.id !== record.gatewayPaymentId ||
            paymentRecord.status !== "captured" ||
            paymentRecord.order_id !== record.gatewayOrderId ||
            paymentRecord.currency !== "INR" ||
            Number(paymentRecord.amount) !== record.amountPaise) {
          await markRazorpayWebhookEventStatus(record.eventId, "needs_review");
          return res.status(200).json({ received: true, needsReview: true, reason: "gateway_payment_mismatch" });
        }

        await ensureInventoryTable();
        await ensureProductVariantSchema();
        await ensurePaymentEventLogTable();

        let connection;
        try {
          connection = await pool.getConnection();
          await connection.beginTransaction();
          const [orderRows] = await connection.execute(
            "SELECT * FROM orders WHERE razorpay_order_id = ? LIMIT 1 FOR UPDATE",
            [record.gatewayOrderId]
          );

          if (!orderRows.length) {
            await markRazorpayWebhookEventStatus(record.eventId, "needs_review", connection);
            await connection.commit();
            return res.status(200).json({ received: true, needsReview: true, reason: "sarine_order_not_found" });
          }

          const order = orderRows[0];
          const expectedAmountPaise = Number(
            order.razorpay_amount_paise || Math.round(Number(order.total) * 100)
          );
          if (order.payment_method !== "online" ||
              !matchesOrderRazorpayId(order, record.gatewayOrderId, paymentRecord.order_id) ||
              expectedAmountPaise !== Number(paymentRecord.amount)) {
            await markRazorpayWebhookEventStatus(record.eventId, "needs_review", connection);
            await connection.commit();
            return res.status(200).json({ received: true, needsReview: true, reason: "sarine_order_mismatch" });
          }

          const settlement = await settleCapturedPayment(connection, {
            order,
            cleanOrderNumber: order.order_number,
            razorpay_order_id: record.gatewayOrderId,
            razorpay_payment_id: record.gatewayPaymentId,
            paymentRecord
          });
          const eventStatus = settlement.needsRefund || settlement.additionalPaymentCaptured
            ? "needs_review"
            : "processed";
          await markRazorpayWebhookEventStatus(record.eventId, eventStatus, connection);
          await connection.commit();
          return res.status(200).json({
            received: true,
            duplicate: !result.inserted,
            paymentSettlement: eventStatus,
            settlement
          });
        } catch (settlementError) {
          if (connection) await connection.rollback().catch(() => {});
          throw settlementError;
        } finally {
          connection?.release();
        }
      }

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
