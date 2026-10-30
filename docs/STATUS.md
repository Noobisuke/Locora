# Locora feature status (final for this build session)
Legend: **TESTED** = actually executed with evidence. **NOT TESTED** = code written, never run. **NOT IMPLEMENTED**.
Only one thing was executed: the Razorpay signature unit tests (`cd services/api && npm test` -> 5 passed). `npm run smoke` (~60 checks) exists but has NOT been run.

| Area | Feature | Status |
|---|---|---|
| Foundation | Prisma schema (18 tables), seed script, env validation, health endpoint | NOT TESTED (no migration file yet; run `prisma migrate dev`) |
| Auth | Register, login, /me, bcrypt, JWT, rate limit, role never from signup | NOT TESTED |
| Auth | Password reset (token logic) | NOT TESTED; email provider NOT CONNECTED |
| Catalog | Categories, product list (search/filter/sort/paging), details | NOT TESTED |
| Customer | Addresses, server cart + totals, wishlist | NOT TESTED |
| Orders | COD checkout, atomic stock, idempotency, per-store sub-orders, history, cancel | NOT TESTED |
| Payments | Razorpay create/verify/webhook/idempotent/expiry | NOT TESTED against Razorpay (needs your test keys) |
| Payments | Signature verification functions | **TESTED** (5/5 unit tests) |
| Payments | Refunds / cancel paid online order | NOT IMPLEMENTED |
| Seller | Apply, store profile, logo upload, dashboard, product CRUD, image upload (Cloudinary), inventory, order fulfillment | NOT TESTED |
| Admin | Stats, users, approvals, product moderation, orders, audit log, delivery assignment | NOT TESTED |
| Delivery | Partner approval, assigned deliveries, status flow, COD paid on delivery | NOT TESTED |
| Reviews | Verified-buyer reviews + average | NOT TESTED |
| Website | Home, search/filter, product + reviews, cart, checkout, orders, account, seller, admin, delivery pages | NOT TESTED (never built or opened; responsive CSS unverified at any size) |
| Mobile | Login/register, home, product, cart, checkout (COD), orders, profile, wishlist, addresses | NOT TESTED (source overlay) |
| Mobile | Seller/admin/delivery screens, Razorpay, profile photo | NOT IMPLEMENTED |
| Other | Notifications, coupons, maps/nearby-by-distance, area selector, email verification | NOT IMPLEMENTED |
| Docs | README, API, ER diagram, deployment checklist, limitations, credentials list, UI spec | Written |

First thing to do: follow README, then `npm run smoke`, and send me the FAIL lines.
