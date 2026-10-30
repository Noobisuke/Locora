import "express-async-errors"; // forwards errors from async routes to the error handler
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import { prisma } from "./db";
import { authRouter } from "./routes/auth";
import { catalogRouter } from "./routes/catalog";
import { addressRouter } from "./routes/addresses";
import { cartRouter, wishlistRouter } from "./routes/cart";
import { orderRouter } from "./routes/orders";
import { sellerRouter } from "./routes/seller";
import { adminRouter } from "./routes/admin";
import { deliveryRouter } from "./routes/delivery";
import { paymentRouter, razorpayWebhook } from "./routes/payments";
import { reviewRouter } from "./routes/reviews";
import { expireUnpaidOrders } from "./lib/expire";

const app = express();
const allowed = config.CORS_ORIGINS.split(",").map((s) => s.trim().replace(/\/+$/, "")); // tolerate a trailing slash
// Hosting platforms (Render, Railway, Fly...) put a proxy in front of the app. Without this, every user appears to
// come from the proxy's IP and they all share ONE rate-limit bucket.
if (config.NODE_ENV === "production") app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: allowed })); // mobile apps send no Origin header and are unaffected by CORS
// Webhook must see the RAW body (for signature check), so it is registered BEFORE express.json().
app.post("/api/payments/razorpay/webhook", express.raw({ type: "application/json", limit: "100kb" }), razorpayWebhook);
app.use(express.json({ limit: "100kb" }));
app.use(morgan(config.NODE_ENV === "production" ? "combined" : "dev")); // logs request lines only, not bodies

app.get("/api/health", async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ status: "ok", database: "up" }); }
  catch { res.status(503).json({ status: "degraded", database: "down" }); }
});

// Serverless replacement for the timer below: at most once per 5 minutes per running instance.
let lastExpire = 0;
app.use(["/api/orders", "/api/cart", "/api/products"], async (_req: Request, _res: Response, next: NextFunction) => {
  if (process.env.VERCEL && Date.now() - lastExpire > 5 * 60_000) {
    lastExpire = Date.now();
    await expireUnpaidOrders().catch((e) => console.error("expire job error", e));
  }
  next();
});

app.use("/api/auth", rateLimit({ windowMs: 15 * 60_000, limit: config.NODE_ENV === "production" ? 30 : 300, standardHeaders: true, legacyHeaders: false }), authRouter);
app.use("/api", catalogRouter);
app.use("/api", reviewRouter);
app.use("/api/addresses", addressRouter);
app.use("/api/cart", cartRouter);
app.use("/api/wishlist", wishlistRouter);
app.use("/api/orders", orderRouter);
app.use("/api/seller", sellerRouter);
app.use("/api/admin", adminRouter);
app.use("/api/delivery", deliveryRouter);
app.use("/api/payments", paymentRouter);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if ((err as { code?: string }).code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "Image is too large (max 5 MB)" });
  console.error(err); // server log only; client gets a safe message
  // In development the real cause is included so it shows up in test output. Production stays generic.
  res.status(500).json({ error: "Something went wrong", ...(config.NODE_ENV !== "production" && { detail: err.message.slice(0, 500) }) });
});

app.listen(config.PORT, () => console.log(`Locora API listening on http://localhost:${config.PORT}`));
// Locally/on a normal server a timer clears abandoned online orders. Serverless (Vercel) has no always-on process,
// so there the same job runs opportunistically from the middleware above instead.
if (!process.env.VERCEL) setInterval(() => expireUnpaidOrders().catch((e) => console.error("expire job error", e)), 5 * 60_000);