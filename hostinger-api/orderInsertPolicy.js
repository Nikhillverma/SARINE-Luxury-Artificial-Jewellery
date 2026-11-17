const PAYMENT_STATES = Object.freeze({
  cod: Object.freeze({ method: "'cod'", paymentStatus: "'pending'", orderStatus: "'placed'" }),
  online: Object.freeze({ method: "'online'", paymentStatus: "'pending'", orderStatus: "'awaiting_payment'" })
});

export function buildOrderInsert({
  paymentMethod,
  orderNumber,
  customerId,
  customerName,
  customerEmail,
  customerPhone,
  shippingAddress,
  subtotal,
  shippingFee,
  total,
  couponCode,
  discountAmount,
  publicTokenHash
}) {
  const state = PAYMENT_STATES[paymentMethod];
  if (!state) {
    throw new Error("Unsupported order payment method.");
  }

  const sql = `INSERT INTO orders (
    id, order_number, customer_id, customer_name, customer_email, customer_phone,
    shipping_address, subtotal, shipping_fee, total, coupon_code, discount_amount, payment_method,
    payment_status, order_status, public_token_hash, source_document, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${state.method}, ${state.paymentStatus}, ${state.orderStatus}, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`;

  const values = [
    orderNumber,
    orderNumber,
    customerId,
    customerName,
    customerEmail,
    customerPhone,
    shippingAddress,
    subtotal,
    shippingFee,
    total,
    couponCode,
    discountAmount,
    publicTokenHash,
    JSON.stringify({ source: "web_checkout" })
  ];

  return { sql, values };
}
