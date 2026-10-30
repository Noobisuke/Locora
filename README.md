# Locora — E-Commerce App for Local Users
*Everything Around You, Your City, Your Store.*

**Status:** API, website and mobile app all type-check; the website builds for production; the Razorpay unit tests pass. The API has not been run against a live database in the build sandbox, so run `npm run smoke` after setup.



Docs: STATUS.md · API.md · ER_DIAGRAM.md · DEPLOYMENT.md · LIMITATIONS_AND_CREDENTIALS.md · UI_SPEC.md

## Quick start (Windows 11 / macOS / Linux)

**You need:** Node.js 20+ (22 LTS recommended) and a PostgreSQL database — either installed locally *or* a free hosted one from https://neon.com (see "No local PostgreSQL?" below).

Run the three parts in **separate terminals**. Start with the API.

### 1. API (port 4000)
```powershell
cd services\api
copy .env.example .env          # macOS/Linux: cp .env.example .env
```
Edit `.env`: put your real PostgreSQL password in `DATABASE_URL` and set `JWT_SECRET` to any random string of 32+ characters.
```powershell
npm install                     # also runs `prisma generate` automatically
npx prisma migrate dev --name init   # creates the tables (create the `locora` database first if using local Postgres)
npm run db:seed                 # categories, admin user, sample products
npm run dev
```
Check http://localhost:4000/api/health -> `{"status":"ok","database":"up"}`

### 2. Website (port 3000)
```powershell
cd apps\web
copy .env.example .env.local    # macOS/Linux: cp .env.example .env.local
npm install
npm run dev
```
Open http://localhost:3000

### 3. Mobile app (optional)
```powershell
cd apps\mobile
copy .env.example .env          # set EXPO_PUBLIC_API_URL to http://YOUR-PC-IP:4000/api (see `ipconfig`)
npm install
npx expo start
```
Scan the QR code with the **Expo Go** app (phone and PC on the same Wi-Fi; allow Node through Windows Firewall). Android emulator: use `http://10.0.2.2:4000/api`.

### Logins created by the seed
| Role | Email | Password |
|---|---|---|
| Admin | admin@locora.local | ChangeMe123! (from `SEED_ADMIN_*` in `.env`) |
| Seller | sample-seller@locora.local | SampleSeller123! |
| Customer | register on the website | - |

### Checks
- `cd services/api && npm test` - Razorpay signature unit tests
- `npm run typecheck` in `services/api`, `apps/web`, `apps/mobile`
- `cd apps/web && npm run build` - production build
- `cd services/api && npm run smoke` - end-to-end API test (API must be running; development database only)

### Common problems
- **"Invalid environment configuration"** on API start: `.env` is missing or `JWT_SECRET` is under 32 characters.
- **Website says "Cannot reach the server"**: the API is not running, or `CORS_ORIGINS` in the API `.env` does not match the website URL (default `http://localhost:3000`).
- **Phone cannot connect**: use your PC's IP, not `localhost`; same Wi-Fi; firewall.
- **Seller approved but menu not updated**: open the Become a Seller page once (the role refreshes) or reload.

## Notes
- Money is stored in **paise** (integers). Roles are never accepted from signup requests.
- Dev admin comes from `SEED_ADMIN_*` in `.env`. Remove those and the seed block before deploying.
- Login token is stored in localStorage (MVP); use an httpOnly cookie before production.
- Production API: `npm run build` then `npm start`.

## Razorpay test mode (needs YOUR account)
1. Sign up at https://razorpay.com, open Dashboard -> switch to **Test Mode** -> Account & Settings -> API Keys -> Generate Test Key.
2. Put in `services/api/.env`: `RAZORPAY_KEY_ID=rzp_test_...` and `RAZORPAY_KEY_SECRET=...` then restart the API. (Secret goes ONLY in the backend.)
3. Webhook (needs a public URL; use a tunnel such as ngrok while developing): Dashboard -> Webhooks -> add `https://YOUR-URL/api/payments/razorpay/webhook`,
   events `payment.captured`, `order.paid`, `refund.processed`, set a secret, and put it in `RAZORPAY_WEBHOOK_SECRET`.
4. Test with Razorpay's official test cards/UPI from https://razorpay.com/docs/payments/payments/test-card-upi-details/ . No real money moves in test mode.
5. Run the unit tests: `cd services/api && npm test`.
Do NOT switch to Live keys until KYC/merchant activation is complete and you have tested the full flow including webhooks and refunds.

## Automatic end-to-end check (recommended after setup)
With the API running and seeded (use a DEVELOPMENT database only):
```powershell
cd services\api
npm run smoke
```
It registers users, browses, orders, cancels, applies as seller, approves via admin, creates a product, races 5 buyers for 1 unit,
runs fulfillment and delivery, and prints PASS/FAIL per check. Send me the FAIL lines.

## No local PostgreSQL? Use a free hosted database (Option B)
1. Create a free account at https://neon.com and create a project (any name, nearest region).
2. On the project dashboard open **Connection Details** and copy the connection string (the one starting with `postgresql://`).
3. Paste it as `DATABASE_URL="..."` in `services/api/.env` (replace the localhost line). Keep the quotes. You do NOT need to create a `locora` database yourself.
4. Run the same commands as before: `npx prisma migrate dev --name init`, `npm run db:seed`, `npm run dev`.
If Prisma complains about `channel_binding`, delete `&channel_binding=require` from the end of the link.
If it complains about the pooled connection, untick "Pooled connection" in Connection Details and copy the direct link.
Use this for DEVELOPMENT data only. Never share the link (it contains your password).

## Fixing local PostgreSQL that "is not running"
- Press Win+R, type `services.msc`, find **postgresql-x64-16** (number may differ), right-click -> **Start**; set Startup type to Automatic.
- Open pgAdmin: if it cannot connect, the service is stopped or the port is not 5432.
- Wrong password: the `.env` password must be the one you set during installation. Special characters (@ : / #) in the password must be URL-encoded (e.g. `@` -> `%40`).
