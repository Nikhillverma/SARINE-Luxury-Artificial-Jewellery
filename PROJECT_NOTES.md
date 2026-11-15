# SARINE Store: Current Project Notes

This file describes the current Hostinger-based application. It supersedes older Firebase/Netlify setup notes. Keep it current when architecture or deployment state changes.

## Project and brand

- SARINE is a premium-affordable Indian fashion/artificial jewellery storefront.
- Frontend: React 19, TypeScript, Vite 8, Tailwind CSS v4.
- Backend: Node.js + Express in `hostinger-api/`.
- Database: Hostinger MariaDB, accessed through `mysql2/promise`.
- Payments: Razorpay; the server owns order totals, payment verification, and stock updates.
- Currency: INR; product and checkout amounts are whole rupees.
- Brand palette: lavender/plum `#563568`, `#B69ACF`, pale lavender `#F7F0FA`, rose-gold `#D9B8A0`.
- Storefront: https://lavender-emu-732118.hostingersite.com/
- API app: https://greenyellow-cat-956048.hostingersite.com/
- GitHub source: `Nikhillverma/SARINE-Luxury-Artificial-Jewellery`, default branch `main`.

## Non-negotiable safety and content rules

- Never put server secrets or private keys in frontend code, GitHub, screenshots, or chat.
- Do not change production database data, delete orders, reset counters, or rerun seed/import scripts without a separately reviewed migration plan and verified backup.
- Do not place real Razorpay payments for testing. Use automated tests and non-payment health checks; use Razorpay test mode only when an actual checkout test is specifically planned.
- Do not change Razorpay keys, webhook settings, Hostinger environment variables, database credentials, or deployment settings as part of routine code fixes.
- Do not claim that a GitHub merge means Hostinger has deployed the change. Verify Hostinger deployment/activity separately.
- No fake reviews, fake popularity/sales ranking, fake urgency, fabricated contact details, or unverified claims about materials, plating, waterproofing, anti-tarnish performance, hypoallergenic properties, packaging, shipping, or delivery dates.
- Preserve existing routes and API contracts unless a reviewed change requires otherwise. Avoid unnecessary dependencies and unsafe `any` types.

## Current architecture

### Frontend

- `src/services/index.ts` selects `DATA_SOURCE = 'hostinger'`.
- Public product and category data are loaded from the Hostinger API.
- Orders are created and retrieved through `HostingerOrderService`.
- Admin product management uses the Hostinger admin API and database-backed session authentication.
- Production API fallback is the Hostinger backend app above. The `VITE_HOSTINGER_API_BASE_URL` environment variable can override it; local development uses `/api`.
- Cart contents are client-side, but prices, stock, shipping, and order totals are recalculated by the backend at checkout.

### Backend

- Source: `hostinger-api/`.
- Entry point: `hostinger-api/server.js`.
- Runtime dependencies are isolated in `hostinger-api/package.json`.
- Start command: `node server.js`.
- Test command: `npm test` from `hostinger-api/`.
- Database connection is configured through server-only environment variables in `hostinger-api/.env.example`.
- The API includes health checks, public product/category reads, admin login/session/logout, admin dashboard/products/orders, order creation, payment verification, token-authorized order retrieval, and phone-verified order tracking.
- Admin sessions use an HTTP-only cookie and hashed session tokens stored in MariaDB.
- The backend validates checkout data, obtains prices and stock from MariaDB, calculates shipping on the server, creates sequential SAR order numbers, and stores token-authorized order records.
- Razorpay signatures are checked server-side; captured payment records are fetched from Razorpay before order finalization.
- Payment verification must match the Razorpay order ID persisted on the exact SARINE order. Do not remove this binding check.
- Duplicate product IDs are aggregated before stock checks and inventory deductions. Preserve this protection.

### Main backend routes

- `GET /health` and `GET /health/db`
- `GET /api/products` and `GET /api/products/:slug`
- `GET /api/categories` and `GET /api/categories/:slug`
- `POST /api/admin/auth/login`, `GET /api/admin/auth/session`, `POST /api/admin/auth/logout`
- `GET /api/admin/dashboard`
- `/api/admin/products`
- `/api/admin/orders`
- `POST /api/orders/create`
- `POST /api/orders/verify`
- `GET /api/orders/:orderNumber?t=<public-token>`
- `POST /api/orders/track`

## Current deployment facts and limitations

- Frontend Hostinger site: `lavender-emu-732118.hostingersite.com`.
- Backend Hostinger app: `greenyellow-cat-956048.hostingersite.com`.
- The frontend-to-GitHub auto-deploy integration has previously been unavailable in hPanel; do not assume it is fixed.
- The backend Hostinger app was previously deployed by ZIP/manual upload. GitHub contains the maintained backend source, but a GitHub merge does not itself update the running Hostinger app.
- Confirm both deployed revisions in Hostinger before saying a change is live.
- Direct navigation to some React routes (notably `/admin/login`) previously returned 404 on Hostinger. Verify SPA fallback/deep-link behavior on the actual frontend hosting method before changing routing configuration.
- Never use the old Firebase or Netlify deployment paths as the active production architecture.

## Current main-branch state

- Latest project changes are maintained on `main`.
- Frontend improvements through PR #93 are merged.
- PR #94 corrected all production API fallbacks to the active Hostinger backend app.
- PR #95 bound payment verification to the Razorpay order ID stored on the matching SARINE order.
- PR #96 aggregated duplicate order lines to prevent incorrect stock checks and over-decrementing.
- CI workflow: `.github/workflows/guest-checkout-ci.yml`. It runs frontend dependency install, TypeScript checks, production build, backend syntax checks, and backend tests on matching pull requests.
- Backend tests live in `hostinger-api/tests/`.

## Known launch and follow-up work

1. Verify the live frontend is serving the latest `main` build and that direct navigation to React routes works.
2. Verify the live backend health and database health endpoints, then confirm the Hostinger backend deployment contains the current `hostinger-api/` source.
3. Perform a safe end-to-end checkout review without placing a real payment or creating duplicate live orders.
4. Continue the admin control plane selectively: category management, richer inventory, analytics, customer directory, returns/refunds, and persistent storefront settings must be ported and reviewed against current `main`. Do not merge the old `hostinger-migration` branch wholesale; it has diverged substantially from `main`.
5. A full customer sign-in/account and order-history experience is not yet confirmed on current `main`; do not display placeholder account features as functional.
6. Publish verified customer-support and privacy-request contact details before launch. Do not invent these details.
7. Review refund handling and any required Razorpay webhook configuration before live payments. Never promise automatic refunds unless the integration actually performs them.
8. Add transactional order emails only after selecting and configuring a real server-side email provider.

## Safe working process

1. Inspect current `main` and the relevant live behavior before editing.
2. Make one focused change on a new branch.
3. Add or update tests for backend business/security logic.
4. Open a pull request; wait for frontend and backend CI to pass.
5. Merge only the reviewed PR with the expected head SHA.
6. Treat Hostinger deployment and live verification as a separate step.
7. Never ask the user to expose secrets. If a Hostinger setting must be checked, ask only for a screenshot with credentials and sensitive values hidden.
