# Known limitations
- **Nothing except the Razorpay signature unit tests (5) has been executed.** The API, website and app were written without a database or network. Expect compile/runtime errors on first run.
- No Prisma migration file is included; create it with `npx prisma migrate dev --name init`, then commit the generated folder.
- No automated refunds. Paid online orders cannot be cancelled by customers; refund manually in the Razorpay dashboard. A payment arriving after auto-cancel is logged as `PAID_BUT_ORDER_CANCELLED` for manual refund.
- Razorpay is not available in the mobile app (needs a development build and `react-native-razorpay`); web checkout only.
- Password reset: token logic is implemented, but **no email provider is connected** (`lib/mailer.ts`), so the endpoint returns 503. No web/mobile reset pages yet.
- Not implemented: notifications, profile photo upload, coupons/discount codes, seller/admin/delivery screens in the mobile app, real-time order tracking, maps/route optimisation, distance-based "nearby stores" (home shows recent products; no geolocation filtering), location/area selector.
- Delivery fee is a flat rule (Rs 40, free from Rs 499) in `src/lib/pricing.ts`; no per-store fees or taxes/GST invoices.
- Auth token is kept in browser localStorage (XSS risk); production should use httpOnly cookies. No refresh tokens, no email verification, no 2FA.
- Admin creation is a dev seed only. Seed images are absent (placeholder letters); no licensed photos were bundled.
- `trust proxy` not configured for production rate limiting. No CSRF protection needed for bearer tokens, but revisit if you move to cookies.
- No automated UI tests, no linting/type-check results yet (run `npm run typecheck` in api and web).
- Design references: no web browsing/images were available while designing; the UI is an original design, not derived from inspected references.
- **Security:** MVP-level controls only (hashing, validation, role/ownership checks, rate limits, signature checks). It has NOT had a professional security review or penetration test; get one before taking real payments.

# Accounts and credentials YOU must create
| Need | Where | Goes in |
|---|---|---|
| PostgreSQL (local or hosted) | postgresql.org or Neon/Supabase | `services/api/.env` DATABASE_URL |
| JWT secret | generate a long random string yourself | `.env` JWT_SECRET |
| Cloudinary (image storage) | cloudinary.com (free tier) | `.env` CLOUDINARY_* |
| Razorpay test keys, then live after KYC | razorpay.com | `.env` RAZORPAY_* (backend only) |
| Email provider for password reset | Resend / Brevo / SendGrid / SMTP | implement `lib/mailer.ts` |
| Hosting accounts | Vercel/Render/etc. | deployment |
| Google Play Developer account | play.google.com/console | publishing the app |
| Domain name | any registrar | DNS |
| Privacy policy, terms, support contact | you / a lawyer | website + store listings |
