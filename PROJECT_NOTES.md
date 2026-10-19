# SARINE Store: Project Notes (keep this in the project)

Premium Indian artificial/fashion jewellery D2C store. React + TypeScript, built in Google AI Studio. Market: India. Currency: INR (whole-rupee integers).

## Brand and content rules (always follow)
- Look: warm ivory, champagne gold, charcoal text, serif headings, minimalist, mobile-first.
- No fake reviews, no urgency text ("only 2 left"), no fake discounts.
- No unverified material claims (waterproof, hypoallergenic, anti-tarnish, pure gold, etc.).
- Never put secret keys in React code or in chat. Secrets live only in server environment variables.

## What is DONE (do not redo)
- Types: src/types/product.ts, category.ts, cart.ts, order.ts
- Service layer with interfaces in src/services/interfaces.ts (IProductService, ICategoryService, IAdminProductService, IOrderService). Switch in src/services/index.ts via DATA_SOURCE.
- DATA_SOURCE = 'firebase' (products and categories load from Firestore).
- Secure Serverless Order & Payment System (Netlify Functions):
  - Server helpers in netlify/functions/utils/ (firebaseAdmin.ts, razorpay.ts, storeConfig.ts, security.ts).
  - netlify/functions/create-order.ts: Re-validates customer and address formats, validates positive quantities, checks active status, takes prices strictly from Firestore, computes server shipping & totals, generates sequential orderNumber (SAR-000001+) from a transaction counter doc, creates Razorpay order (amount in paise), generates 32-byte cryptographic publicToken, and saves snapshot in 'orders'.
  - netlify/functions/verify-payment.ts: Timing-safe publicToken and HMAC-SHA256 signature verification. In a single Firestore transaction: idempotent if already paid, decrements stock atomically, sets paymentStatus 'paid' & orderStatus 'confirmed'. If stock ran out before payment finalized, sets orderStatus 'needs_refund'.
  - netlify/functions/razorpay-webhook.ts: Validates raw body signature against RAZORPAY_WEBHOOK_SECRET, handles payment.captured/order.paid with idempotent confirmation and stock decrement.
  - netlify/functions/get-order.ts: Token-authorized order retrieval; returns only safe fields.
- Frontend Order Service:
  - src/services/netlify/netlifyOrderService.ts implementing IOrderService via /.netlify/functions/*.
  - src/services/index.ts switches orderService to netlifyOrderService when DATA_SOURCE = 'firebase', and keeps mockOrderService when DATA_SOURCE = 'mock'.
  - CheckoutPage: Dynamically loads Razorpay Checkout (https://checkout.razorpay.com/v1/checkout.js), opens modal with server order ID & key ID, verifies payment via verify-payment server endpoint, navigates to /order/<orderNumber>?t=<publicToken>, and preserves cart if modal dismissed.
  - OrderConfirmationPage: Reads orderNumber and t token from URL, securely fetching order details.
- CartContext with localStorage persistence (stores only productId + quantity, re-checks against live data on load).
- Store config in src/config/store.ts and netlify/functions/utils/storeConfig.ts.
- Netlify configuration in netlify.toml (build, functions folder, and SPA fallback /* -> /index.html 200).
- Server env template in .env.example (no VITE_ secrets).

## Firebase (ONE-TIME setup already finished)
- Firebase project id: sarine-cbcce, Firestore in production mode.
- Client web config configured with fallback in src/lib/firebase.ts for public read operations.
- Database already seeded: 5 categories and 16 products (13 active, 2 draft, 1 archived). DO NOT run the seed again.
- Rules are LOCKED. Current published rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
    match /categories/{categoryId} {
      allow read: if true;
      allow write: if false;
    }
    match /products/{productId} {
      allow read: if resource.data.status == 'active';
      allow write: if false;
    }
    match /orders/{orderId} {
      allow read, write: if false;
    }
    match /users/{userId} {
      allow read, write: if false;
    }
  }
}
```

- Composite indexes needed (create when the console asks or via the error link): products (status, categoryId), (status, createdAt desc), (status, categoryId, createdAt desc).

## Known quirks
- AI Studio's preview always reloads to the home page on refresh. This is the preview, not a bug.
- includeAll is ignored under Firebase (rules only allow active products). Admin access comes later with login.
- Netlify Functions execute on deployed Netlify environments or with "netlify dev". In AI Studio's standalone preview, DATA_SOURCE = 'mock' can be used for end-to-end simulated ordering without a server.

## Still TODO (in order)
1. Deploy to Netlify and add server environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET).
2. Configure Razorpay Webhook in Razorpay Dashboard pointing to https://<your-site>.netlify.app/.netlify/functions/razorpay-webhook with secret RAZORPAY_WEBHOOK_SECRET for payment.captured.
3. Order confirmation email (via serverless email service).
4. Remove "Seed Firestore (Dev)" button and seedFirestore.ts before launch.
5. Firebase Auth (customer accounts) and admin area with an admin-only role.
6. Launch tidy-up: remove test notices, host the site, configure custom domain.
7. Razorpay live mode needs business KYC.

## Accounts and decisions
- Razorpay account: created. Use TEST mode keys until KYC is done.
- Node.js 22 installed on the user's Windows PC.
- User wants the FREE plan (no Firebase Blaze). Plan: GitHub + Netlify free plan for hosting and server functions.
- Undecided: shipping fee/free-shipping threshold, Cash on Delivery yes/no (both are set in src/config/store.ts and netlify/functions/utils/storeConfig.ts).

## How to resume
Open the project in AI Studio, check src/services/index.ts says DATA_SOURCE = 'firebase', and continue from the TODO list above.
