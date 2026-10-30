# Deployment checklist (NOT deployed yet — nothing here has been done)
Do this only after local testing passes (`npm run smoke` all PASS, website checked at desktop/tablet/phone widths).

## Suggested hosting (verify current free-tier limits and pricing yourself before choosing)
| Part | Options |
|---|---|
| Website (Next.js) | Vercel, Netlify, or Render |
| API (Express) | Render, Railway, Fly.io, or a small VPS |
| PostgreSQL | Neon, Supabase, Render Postgres, Railway Postgres |
| Images | Cloudinary (already integrated) |
| Android app | EAS Build (Expo) -> .apk for testing, .aab for Google Play |

## Steps
1. **Database:** create a production database separate from development. Turn on automatic backups (provider setting) and test one restore. Run `npx prisma migrate deploy` (NOT `migrate dev`). **Do not run the seed in production** (it refuses, by design). Create the first admin through a one-time controlled step, then delete `SEED_ADMIN_*` from the environment.
2. **API:** set `NODE_ENV=production`, a NEW long random `JWT_SECRET`, `DATABASE_URL`, `CORS_ORIGINS=https://your-site-domain` (exact origins only, no `*`), Cloudinary keys. Build with `npm run build`, start with `npm start`. Health check path: `/api/health`.
3. **Website:** set `NEXT_PUBLIC_API_URL=https://your-api-domain/api`. Only public values go here.
4. **HTTPS:** hosts above give HTTPS automatically on their domains. For a custom domain, add DNS records the host tells you. Browsers block a HTTPS website calling an HTTP API, so the API must be HTTPS too. Behind a proxy, set `app.set("trust proxy", 1)` in `index.ts` so rate limiting sees real client IPs (not done yet).
5. **Payments (Razorpay):** complete merchant onboarding/KYC first. Test the full flow in Test Mode including the webhook. Only then replace keys with Live keys, set the live webhook, and make one small real payment and refund.
6. **Mobile:** set `EXPO_PUBLIC_API_URL` to the HTTPS API. Build with EAS. Google Play needs a developer account (one-time fee), privacy policy URL, and store listing.
7. **Monitoring:** enable your host's logs; add an error tracker (e.g. Sentry) and an uptime monitor on `/api/health`.
8. **Legal & support:** publish Privacy Policy and Terms of Service (have them reviewed; you collect names, emails, phones, addresses), refund/cancellation policy, and a support email/phone. Required by Razorpay and Google Play.
9. **Before launch:** change/delete the dev admin, rotate every secret that was ever in a chat/screenshot, run a dependency audit (`npm audit`), and get a security review (see LIMITATIONS).
