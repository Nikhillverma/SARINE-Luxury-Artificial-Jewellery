import test from "node:test";
import assert from "node:assert/strict";
import { processCapturedPaymentWebhook } from "../razorpayCapturedPayment.js";
import { settleCapturedPayment } from "../paymentSettlement.js";
import { classifyCapturedPayment } from "../paymentValidation.js";

test("MariaDB serializes simultaneous captures so shared settlement deducts stock once", {
  skip: !process.env.DB_HOST
}, async () => {
  const { pool } = await import("../db.js");
  const payment = {
    id: "pay_integration_1",
    order_id: "order_integration_1",
    amount: 1000,
    currency: "INR",
    status: "captured"
  };
  const orderNumber = "SAR-999991";
  const paymentEvents = new Set();

  try {
    await pool.query("DROP TABLE IF EXISTS razorpay_webhook_events");
    await pool.query("DROP TABLE IF EXISTS order_status_history");
    await pool.query("DROP TABLE IF EXISTS order_items");
    await pool.query("DROP TABLE IF EXISTS products");
    await pool.query("DROP TABLE IF EXISTS orders");

    await pool.query(`
      CREATE TABLE orders (
        id VARCHAR(64) PRIMARY KEY,
        order_number VARCHAR(32) NOT NULL,
        payment_method VARCHAR(16) NOT NULL,
        payment_status VARCHAR(20) NOT NULL,
        order_status VARCHAR(32) NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        razorpay_amount_paise BIGINT NULL,
        razorpay_order_id VARCHAR(64) NOT NULL,
        razorpay_payment_id VARCHAR(64) NULL,
        refund_needed TINYINT(1) NOT NULL DEFAULT 0,
        refund_amount DECIMAL(10,2) NULL,
        updated_at DATETIME(3) NULL,
        UNIQUE KEY uq_test_order_number (order_number),
        KEY idx_orders_razorpay_order_id (razorpay_order_id)
      ) ENGINE=InnoDB
    `);
    await pool.query(`
      CREATE TABLE products (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        stock INT UNSIGNED NOT NULL,
        updated_at DATETIME(3) NULL
      ) ENGINE=InnoDB
    `);
    await pool.query(`
      CREATE TABLE order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(64) NOT NULL,
        product_id VARCHAR(64) NOT NULL,
        variant_id VARCHAR(64) NULL,
        variant_sku VARCHAR(100) NULL,
        variant_label VARCHAR(255) NULL,
        quantity INT NOT NULL,
        product_name VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB
    `);
    await pool.query(`
      CREATE TABLE order_status_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(64) NOT NULL,
        old_status VARCHAR(32) NULL,
        new_status VARCHAR(32) NOT NULL,
        note VARCHAR(1000) NOT NULL,
        changed_by VARCHAR(64) NOT NULL,
        created_at DATETIME(3) NOT NULL
      ) ENGINE=InnoDB
    `);
    await pool.query(`
      CREATE TABLE razorpay_webhook_events (
        event_id VARCHAR(128) PRIMARY KEY,
        event_status VARCHAR(40) NOT NULL,
        processed_at DATETIME(3) NULL
      ) ENGINE=InnoDB
    `);

    await pool.execute(
      `INSERT INTO orders
       (id, order_number, payment_method, payment_status, order_status, total,
        razorpay_amount_paise, razorpay_order_id)
       VALUES ('order-db-1', ?, 'online', 'pending', 'awaiting_payment', 10.00, 1000, ?)`,
      [orderNumber, payment.order_id]
    );
    await pool.execute(
      "INSERT INTO products (id, name, stock) VALUES ('prod-1', 'Concurrency test item', 3)"
    );
    await pool.execute(
      `INSERT INTO order_items (order_id, product_id, quantity, product_name)
       VALUES ('order-db-1', 'prod-1', 1, 'Concurrency test item')`
    );
    await pool.execute(
      "INSERT INTO razorpay_webhook_events (event_id, event_status) VALUES ('evt_db_a', 'received'), ('evt_db_b', 'received')"
    );

    const settlementDependencies = {
      sortStockItems: items => items,
      formatVariantLabel: () => "",
      syncProductVariantStock: async () => {},
      recordVariantInventoryMovement: async () => {},
      recordInventoryMovement: async () => {},
      confirmCouponRedemption: async () => {},
      releaseCouponRedemptionForCancelledOrder: async () => {},
      recordVerifiedPaymentEvent: async (_connection, event) => {
        const inserted = !paymentEvents.has(event.gatewayPaymentId);
        paymentEvents.add(event.gatewayPaymentId);
        return { inserted };
      },
      classifyCapturedPayment
    };

    const dependencies = {
      getEventStatus: async eventId => {
        const [rows] = await pool.execute(
          "SELECT event_status FROM razorpay_webhook_events WHERE event_id = ?",
          [eventId]
        );
        return rows[0]?.event_status || null;
      },
      markEventStatus: async (eventId, status, connection) => {
        await connection.execute(
          "UPDATE razorpay_webhook_events SET event_status = ?, processed_at = UTC_TIMESTAMP(3) WHERE event_id = ?",
          [status, eventId]
        );
      },
      ensureInventoryTable: async () => {},
      ensureProductVariantSchema: async () => {},
      ensurePaymentEventLogTable: async () => {},
      getConnection: () => pool.getConnection(),
      getRazorpay: () => ({ payments: { fetch: async () => payment } }),
      settleCapturedPayment: (connection, context) =>
        settleCapturedPayment(connection, context, value => value, settlementDependencies)
    };

    const baseRecord = {
      eventType: "payment.captured",
      gatewayOrderId: payment.order_id,
      gatewayPaymentId: payment.id,
      amountPaise: payment.amount,
      currency: "INR",
      gatewayStatus: "captured"
    };
    const browserVerification = async () => {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [lockedOrders] = await connection.execute(
          "SELECT * FROM orders WHERE order_number = ? FOR UPDATE",
          [orderNumber]
        );
        const settlement = await settleCapturedPayment(connection, {
          order: lockedOrders[0],
          cleanOrderNumber: orderNumber,
          razorpay_order_id: payment.order_id,
          razorpay_payment_id: payment.id,
          paymentRecord: payment
        }, value => value, settlementDependencies);
        await connection.commit();
        return settlement;
      } catch (error) {
        await connection.rollback().catch(() => {});
        throw error;
      } finally {
        connection.release();
      }
    };

    const [first, second, duplicateDelivery, browserResult] = await Promise.all([
      processCapturedPaymentWebhook({
        record: { ...baseRecord, eventId: "evt_db_a" },
        eventId: "evt_db_a",
        inserted: true
      }, dependencies),
      processCapturedPaymentWebhook({
        record: { ...baseRecord, eventId: "evt_db_b" },
        eventId: "evt_db_b",
        inserted: true
      }, dependencies),
      processCapturedPaymentWebhook({
        record: { ...baseRecord, eventId: "evt_db_a" },
        eventId: "evt_db_a",
        inserted: false
      }, dependencies),
      browserVerification()
    ]);

    const [orders] = await pool.execute(
      "SELECT payment_status, order_status, razorpay_payment_id FROM orders WHERE id = 'order-db-1'"
    );
    const [products] = await pool.execute("SELECT stock FROM products WHERE id = 'prod-1'");
    const [events] = await pool.execute(
      "SELECT event_status FROM razorpay_webhook_events ORDER BY event_id"
    );
    const [movements] = await pool.execute("SELECT COUNT(*) AS total FROM order_status_history WHERE new_status = 'confirmed'");

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(duplicateDelivery.status, 200);
    assert.ok(browserResult.success || browserResult.alreadyProcessed);
    assert.equal(orders[0].payment_status, "paid");
    assert.equal(orders[0].order_status, "confirmed");
    assert.equal(orders[0].razorpay_payment_id, payment.id);
    assert.equal(Number(products[0].stock), 2);
    assert.equal(paymentEvents.size, 1);
    assert.equal(Number(movements[0].total), 1);
    assert.deepEqual(events.map(row => row.event_status), ["processed", "processed"]);

    const cancelledPayment = {
      id: "pay_late_cancelled_1",
      order_id: "order_late_cancelled_1",
      amount: 1000,
      currency: "INR",
      status: "captured"
    };
    await pool.execute(
      `INSERT INTO orders
       (id, order_number, payment_method, payment_status, order_status, total,
        razorpay_amount_paise, razorpay_order_id)
       VALUES ('order-db-cancelled', 'SAR-999992', 'online', 'pending', 'cancelled', 10.00, 1000, ?)`,
      [cancelledPayment.order_id]
    );
    await pool.execute(
      "INSERT INTO razorpay_webhook_events (event_id, event_status) VALUES ('evt_db_cancelled', 'received')"
    );
    const cancelledResult = await processCapturedPaymentWebhook({
      record: {
        eventType: "payment.captured",
        eventId: "evt_db_cancelled",
        gatewayOrderId: cancelledPayment.order_id,
        gatewayPaymentId: cancelledPayment.id,
        amountPaise: cancelledPayment.amount,
        currency: "INR",
        gatewayStatus: "captured"
      },
      eventId: "evt_db_cancelled",
      inserted: true
    }, {
      ...dependencies,
      getRazorpay: () => ({ payments: { fetch: async () => cancelledPayment } })
    });
    const [cancelledOrders] = await pool.execute(
      "SELECT payment_status, order_status, refund_needed, refund_amount FROM orders WHERE id = 'order-db-cancelled'"
    );
    const [stockAfterLateCapture] = await pool.execute(
      "SELECT stock FROM products WHERE id = 'prod-1'"
    );
    assert.equal(cancelledResult.status, 200);
    assert.equal(cancelledResult.body.paymentSettlement, "needs_review");
    assert.equal(cancelledOrders[0].payment_status, "paid");
    assert.equal(cancelledOrders[0].order_status, "cancelled");
    assert.equal(Number(cancelledOrders[0].refund_needed), 1);
    assert.equal(Number(cancelledOrders[0].refund_amount), 10);
    assert.equal(Number(stockAfterLateCapture[0].stock), 2);
  } finally {
    await pool.query("DROP TABLE IF EXISTS razorpay_webhook_events");
    await pool.query("DROP TABLE IF EXISTS order_status_history");
    await pool.query("DROP TABLE IF EXISTS order_items");
    await pool.query("DROP TABLE IF EXISTS products");
    await pool.query("DROP TABLE IF EXISTS orders");
    await pool.end();
  }
});
