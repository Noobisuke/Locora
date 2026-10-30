# Locora API (Phase 2) — all untested
Protected routes need `Authorization: Bearer <token>`. Money is in paise.

| Method & path | Auth | Purpose |
|---|---|---|
| GET /api/health | - | database connectivity |
| POST /api/auth/register, /api/auth/login; GET /api/auth/me | - / token | accounts |
| GET /api/categories, /api/products, /api/products/:id | - | browse (q, category, minPrice, maxPrice, sort, page) |
| GET/POST /api/addresses; PUT/DELETE /api/addresses/:id | customer | own addresses only |
| GET /api/cart; PUT /api/cart/items {productId, quantity}; DELETE /api/cart | customer | server-side cart and totals |
| GET /api/wishlist; PUT/DELETE /api/wishlist/:productId | customer | wishlist |
| POST /api/orders {addressId, paymentMethod:"COD", idempotencyKey?} | customer | place order from the cart |
| GET /api/orders, /api/orders/:id; POST /api/orders/:id/cancel | customer | history, detail, cancel |

Rules: delivery Rs 40, free from Rs 499 (src/lib/pricing.ts). Stock is reserved atomically inside the order
transaction. One sub-order (seller_fulfillment) is created per store.

## Phase 3 (seller + admin) — untested
Seller (`/api/seller`): POST /apply (customer) · GET /application · GET/PUT /store · GET /dashboard ·
GET/POST /products · PUT/DELETE /products/:id (delete = deactivate) · POST /products/:id/images (multipart field `image`, JPEG/PNG/WebP, 5 MB, max 6) ·
PUT /products/:id/images/:imageId/primary · DELETE /products/:id/images/:imageId · GET /orders · PATCH /fulfillments/:id/status
(PENDING→CONFIRMED|REJECTED, CONFIRMED→PACKED, PACKED→HANDED_OVER; REJECTED restores stock).
Prices are sent in paise. Image upload returns 503 until Cloudinary keys are set in `.env`.

Admin (`/api/admin`, ADMIN only): GET /dashboard · GET /users · PATCH /users/:id/active · GET /seller-applications ·
POST /seller-applications/:id/review {decision, note} (approval promotes the user to SELLER and creates the store) ·
GET /products · PATCH /products/:id/moderation {blocked} · GET /orders · GET /audit-logs.

## Phase 4 (delivery) — untested
Admin: GET /api/admin/delivery-partners · PATCH /api/admin/users/:id/delivery-partner {enabled} · POST /api/admin/fulfillments/:id/assign {partnerId} (only PACKED/HANDED_OVER).
Delivery partner (`/api/delivery`, role DELIVERY + admin-approved): GET / (own assignments only) · PATCH /:id/status
(ASSIGNED→PICKED_UP→IN_PROGRESS→DELIVERED|FAILED). When all sub-orders are delivered the order becomes DELIVERED and a COD payment becomes SUCCESS.

## Phase 5 (Razorpay, test mode) — untested against the real gateway
| Method & path | Auth | Purpose |
|---|---|---|
| GET /api/payments/config | - | {onlineEnabled, keyId}; keyId is public, secret never exposed |
| POST /api/orders {paymentMethod:"ONLINE", ...} | customer | creates order + PENDING online payment (503 if keys missing) |
| POST /api/payments/razorpay/create {orderId} | customer | creates Razorpay order; amount read from DB; reuses existing one |
| POST /api/payments/razorpay/verify {razorpay_order_id, razorpay_payment_id, razorpay_signature} | customer | verifies HMAC; PENDING -> SUCCESS once |
| POST /api/payments/razorpay/webhook | Razorpay signature | payment.captured / order.paid -> SUCCESS; refund.processed -> REFUNDED; payment.failed ignored (customer can retry) |

Rules: sellers cannot confirm an ONLINE order until payment is SUCCESS. Unpaid online orders are auto-cancelled after 30 min (stock restored).
Known gap: if a payment arrives after auto-cancel, the server logs PAID_BUT_ORDER_CANCELLED and you must refund manually.
