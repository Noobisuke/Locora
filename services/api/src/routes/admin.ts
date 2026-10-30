import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { audit } from "../lib/audit";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.get("/dashboard", async (_req, res) => {
  const [users, stores, products, pendingApps, orders, revenue] = await Promise.all([
    prisma.user.count(), prisma.store.count(), prisma.product.count(),
    prisma.sellerApplication.count({ where: { status: "PENDING" } }),
    prisma.order.groupBy({ by: ["status"], _count: true }),
    prisma.order.aggregate({ where: { status: { not: "CANCELLED" } }, _sum: { totalPaise: true } }),
  ]);
  res.json({ users, stores, products, pendingApplications: pendingApps, ordersByStatus: orders, revenuePaise: revenue._sum.totalPaise ?? 0 });
});

adminRouter.get("/users", async (_req, res) => {
  res.json({ users: await prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 200, select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true } }) });
});
adminRouter.patch("/users/:id/active", async (req, res) => {
  const p = z.object({ isActive: z.boolean() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input" });
  if (req.params.id === req.user!.id) return res.status(409).json({ error: "You cannot deactivate your own account" });
  const r = await prisma.user.updateMany({ where: { id: req.params.id }, data: { isActive: p.data.isActive } });
  if (r.count === 0) return res.status(404).json({ error: "User not found" });
  await audit(prisma, req.user!.id, p.data.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED", "User", req.params.id);
  res.json({ ok: true });
});

adminRouter.get("/seller-applications", async (req, res) => {
  const parsed = z.enum(["PENDING", "APPROVED", "REJECTED"]).optional().safeParse(req.query.status);
  if (!parsed.success) return res.status(400).json({ error: "Invalid status filter" });
  const status = parsed.data;
  res.json({ applications: await prisma.sellerApplication.findMany({ where: { status }, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true, email: true } } } }) });
});

const reviewSchema = z.object({ decision: z.enum(["APPROVED", "REJECTED"]), note: z.string().max(300).optional() });
adminRouter.post("/seller-applications/:id/review", async (req, res) => {
  const p = reviewSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input" });
  const outcome = await prisma.$transaction(async (tx) => {
    // Only a PENDING application can be reviewed, exactly once.
    const r = await tx.sellerApplication.updateMany({ where: { id: req.params.id, status: "PENDING" }, data: { status: p.data.decision, reviewNote: p.data.note, reviewedAt: new Date() } });
    if (r.count === 0) return "gone" as const;
    const app = await tx.sellerApplication.findUniqueOrThrow({ where: { id: req.params.id } });
    if (p.data.decision === "APPROVED") {
      await tx.user.update({ where: { id: app.userId }, data: { role: "SELLER" } });
      await tx.store.create({ data: { ownerId: app.userId, name: app.storeName, description: app.description, contactPhone: app.contactPhone, address: app.address, serviceArea: app.serviceArea } });
    }
    await audit(tx, req.user!.id, `SELLER_${p.data.decision}`, "SellerApplication", app.id);
    return "ok" as const;
  });
  if (outcome === "gone") return res.status(409).json({ error: "Application not found or already reviewed" });
  res.json({ ok: true });
});

adminRouter.get("/products", async (_req, res) => {
  res.json({ products: await prisma.product.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { store: { select: { name: true } }, images: { take: 1, orderBy: { sortOrder: "asc" } } } }) });
});
adminRouter.patch("/products/:id/moderation", async (req, res) => {
  const p = z.object({ blocked: z.boolean() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input" });
  const r = await prisma.product.updateMany({ where: { id: req.params.id }, data: { moderationBlocked: p.data.blocked } });
  if (r.count === 0) return res.status(404).json({ error: "Product not found" });
  await audit(prisma, req.user!.id, p.data.blocked ? "PRODUCT_BLOCKED" : "PRODUCT_UNBLOCKED", "Product", req.params.id);
  res.json({ ok: true });
});

adminRouter.get("/orders", async (_req, res) => {
  res.json({ orders: await prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { name: true, email: true } }, payments: true, fulfillments: { include: { store: { select: { name: true } }, delivery: true } } } }) });
});
adminRouter.get("/audit-logs", async (_req, res) => {
  res.json({ logs: await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { actor: { select: { name: true } } } }) });
});

// ---- Delivery management (manual assignment) ----
adminRouter.get("/delivery-partners", async (_req, res) => {
  res.json({ partners: await prisma.user.findMany({ where: { role: "DELIVERY", deliveryApproved: true, isActive: true }, select: { id: true, name: true, phone: true } }) });
});
adminRouter.patch("/users/:id/delivery-partner", async (req, res) => {
  const p = z.object({ enabled: z.boolean() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input" });
  const u = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!u) return res.status(404).json({ error: "User not found" });
  if (p.data.enabled) {
    if (u.role !== "CUSTOMER" && u.role !== "DELIVERY") return res.status(409).json({ error: "Only customer accounts can become delivery partners" });
    await prisma.user.update({ where: { id: u.id }, data: { role: "DELIVERY", deliveryApproved: true } });
  } else {
    if (u.role !== "DELIVERY") return res.status(409).json({ error: "User is not a delivery partner" });
    const open = await prisma.delivery.count({ where: { partnerId: u.id, status: { in: ["ASSIGNED", "PICKED_UP", "IN_PROGRESS"] } } });
    if (open > 0) return res.status(409).json({ error: "Partner still has active deliveries" });
    await prisma.user.update({ where: { id: u.id }, data: { role: "CUSTOMER", deliveryApproved: false } });
  }
  await audit(prisma, req.user!.id, p.data.enabled ? "DELIVERY_PARTNER_ENABLED" : "DELIVERY_PARTNER_DISABLED", "User", u.id);
  res.json({ ok: true });
});
adminRouter.post("/fulfillments/:id/assign", async (req, res) => {
  const p = z.object({ partnerId: z.string().min(1) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input" });
  const partner = await prisma.user.findFirst({ where: { id: p.data.partnerId, role: "DELIVERY", deliveryApproved: true, isActive: true } });
  if (!partner) return res.status(400).json({ error: "Delivery partner not found or not approved" });
  const f = await prisma.sellerFulfillment.findUnique({ where: { id: req.params.id }, include: { delivery: true } });
  if (!f) return res.status(404).json({ error: "Fulfillment not found" });
  if (f.status !== "PACKED" && f.status !== "HANDED_OVER") return res.status(409).json({ error: "Seller has not packed this order yet" });
  if (f.delivery) return res.status(409).json({ error: "Already assigned" });
  try {
    await prisma.delivery.create({ data: { fulfillmentId: f.id, partnerId: partner.id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return res.status(409).json({ error: "Already assigned" });
    throw e;
  }
  await audit(prisma, req.user!.id, "DELIVERY_ASSIGNED", "SellerFulfillment", f.id);
  res.status(201).json({ ok: true });
});
