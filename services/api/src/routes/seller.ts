import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { imageUpload, isRealImage, storageConfigured, uploadToCloudinary, deleteFromCloudinary } from "../lib/upload";
import { syncOrderStatus } from "../lib/orderStatus";

export const sellerRouter = Router();
sellerRouter.use(requireAuth);

const phone = z.string().regex(/^[0-9+\-\s]{7,15}$/);
const applySchema = z.object({
  storeName: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  contactPhone: phone,
  address: z.string().trim().min(5).max(200),
  serviceArea: z.string().trim().min(2).max(100),
});

// ---- Application (any logged-in customer) ----
sellerRouter.post("/apply", async (req, res) => {
  if (req.user!.role !== "CUSTOMER") return res.status(409).json({ error: "Only customer accounts can apply" });
  const p = applySchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input", details: p.error.flatten().fieldErrors });
  const pending = await prisma.sellerApplication.findFirst({ where: { userId: req.user!.id, status: "PENDING" } });
  if (pending) return res.status(409).json({ error: "You already have a pending application" });
  const application = await prisma.sellerApplication.create({ data: { ...p.data, userId: req.user!.id } });
  res.status(201).json({ application });
});
sellerRouter.get("/application", async (req, res) => {
  const application = await prisma.sellerApplication.findFirst({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" } });
  res.json({ application });
});

// Everything below: approved sellers only (role is set to SELLER by an admin on approval).
const sellerOnly = requireRole("SELLER");
// Role check + "has a store" check in ONE middleware, so a SELLER without a store row gets a clean 404 instead of a crash.
const seller = (req: Request, res: Response, next: NextFunction) =>
  sellerOnly(req, res, async () => {
    try {
      if (!(await myStore(req.user!.id))) return res.status(404).json({ error: "Store not found for this seller account" });
      next();
    } catch (e) { next(e); }
  });
async function myStore(userId: string) { return prisma.store.findFirst({ where: { ownerId: userId } }); }

sellerRouter.get("/store", seller, async (req, res) => {
  const store = await myStore(req.user!.id);
  if (!store) return res.status(404).json({ error: "Store not found" });
  res.json({ store });
});
sellerRouter.put("/store", seller, async (req, res) => {
  const p = applySchema.omit({ storeName: true }).extend({ name: z.string().trim().min(2).max(80) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input", details: p.error.flatten().fieldErrors });
  const store = await myStore(req.user!.id);
  if (!store) return res.status(404).json({ error: "Store not found" });
  res.json({ store: await prisma.store.update({ where: { id: store.id }, data: p.data }) });
});

sellerRouter.post("/store/logo", seller, imageUpload.single("image"), async (req, res) => {
  if (!storageConfigured()) return res.status(503).json({ error: "Image storage is not configured on the server (Cloudinary keys missing)" });
  if (!req.file) return res.status(400).json({ error: "Attach an image file in the 'image' field" });
  if (!isRealImage(req.file.buffer)) return res.status(400).json({ error: "Only JPEG, PNG or WebP images are allowed" });
  const store = await myStore(req.user!.id);
  if (!store) return res.status(404).json({ error: "Store not found" });
  const up = await uploadToCloudinary(req.file.buffer, req.file.mimetype);
  res.json({ store: await prisma.store.update({ where: { id: store.id }, data: { logoUrl: up.url } }) });
});

sellerRouter.get("/dashboard", seller, async (req, res) => {
  const store = await myStore(req.user!.id);
  if (!store) return res.status(404).json({ error: "Store not found" });
  const [total, active, lowStock, byStatus, sales] = await Promise.all([
    prisma.product.count({ where: { storeId: store.id } }),
    prisma.product.count({ where: { storeId: store.id, isActive: true } }),
    prisma.product.findMany({ where: { storeId: store.id, isActive: true, stock: { lte: 5 } }, select: { id: true, name: true, stock: true } }),
    prisma.sellerFulfillment.groupBy({ by: ["status"], where: { storeId: store.id }, _count: true }),
    prisma.sellerFulfillment.aggregate({ where: { storeId: store.id, status: { in: ["CONFIRMED", "PACKED", "HANDED_OVER"] } }, _sum: { subtotalPaise: true } }),
  ]);
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  res.json({
    totalProducts: total, activeProducts: active, lowStock,
    orders: { pending: count("PENDING"), confirmed: count("CONFIRMED"), completed: count("HANDED_OVER") },
    salesPaise: sales._sum.subtotalPaise ?? 0, // confirmed + packed + handed over; excludes pending/rejected/cancelled
  });
});

// ---- Products ----
const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(5).max(2000),
  categoryId: z.string().min(1),
  pricePaise: z.number().int().min(100).max(100_000_000),
  originalPricePaise: z.number().int().positive().nullish(),
  stock: z.number().int().min(0).max(100_000),
  isActive: z.boolean().default(true),
}).refine((d) => !d.originalPricePaise || d.originalPricePaise > d.pricePaise, { message: "Original price must exceed price", path: ["originalPricePaise"] });

const withImages = { images: { orderBy: { sortOrder: "asc" as const } }, category: true };

sellerRouter.get("/products", seller, async (req, res) => {
  const store = await myStore(req.user!.id);
  res.json({ products: await prisma.product.findMany({ where: { storeId: store!.id }, orderBy: { createdAt: "desc" }, include: withImages }) });
});
sellerRouter.post("/products", seller, async (req, res) => {
  const p = productSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input", details: p.error.flatten().fieldErrors });
  const store = await myStore(req.user!.id);
  if (!store || !store.isActive) return res.status(403).json({ error: "Your store is not active" });
  const cat = await prisma.category.findUnique({ where: { id: p.data.categoryId } });
  if (!cat) return res.status(400).json({ error: "Unknown category" });
  const product = await prisma.product.create({ data: { ...p.data, originalPricePaise: p.data.originalPricePaise ?? null, storeId: store.id }, include: withImages });
  res.status(201).json({ product });
});
// storeId is always part of the filter, so one seller can never edit another seller's product.
sellerRouter.put("/products/:id", seller, async (req, res) => {
  const p = productSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input", details: p.error.flatten().fieldErrors });
  const store = await myStore(req.user!.id);
  const cat = await prisma.category.findUnique({ where: { id: p.data.categoryId } });
  if (!cat) return res.status(400).json({ error: "Unknown category" });
  const r = await prisma.product.updateMany({ where: { id: req.params.id, storeId: store!.id }, data: { ...p.data, originalPricePaise: p.data.originalPricePaise ?? null } });
  if (r.count === 0) return res.status(404).json({ error: "Product not found" });
  res.json({ product: await prisma.product.findUnique({ where: { id: req.params.id }, include: withImages }) });
});
// "Delete" = deactivate, so old orders keep their product history.
sellerRouter.delete("/products/:id", seller, async (req, res) => {
  const store = await myStore(req.user!.id);
  const r = await prisma.product.updateMany({ where: { id: req.params.id, storeId: store!.id }, data: { isActive: false } });
  if (r.count === 0) return res.status(404).json({ error: "Product not found" });
  res.status(204).end();
});

// ---- Product images ----
const MAX_IMAGES = 6;
sellerRouter.post("/products/:id/images", seller, imageUpload.single("image"), async (req, res) => {
  if (!storageConfigured()) return res.status(503).json({ error: "Image storage is not configured on the server (Cloudinary keys missing)" });
  if (!req.file) return res.status(400).json({ error: "Attach an image file in the 'image' field" });
  if (!isRealImage(req.file.buffer)) return res.status(400).json({ error: "Only JPEG, PNG or WebP images are allowed" });
  const store = await myStore(req.user!.id);
  const product = await prisma.product.findFirst({ where: { id: req.params.id, storeId: store!.id }, include: { images: true } });
  if (!product) return res.status(404).json({ error: "Product not found" });
  if (product.images.length >= MAX_IMAGES) return res.status(409).json({ error: `Maximum ${MAX_IMAGES} images per product` });
  const up = await uploadToCloudinary(req.file.buffer, req.file.mimetype);
  const image = await prisma.productImage.create({
    data: { productId: product.id, url: up.url, publicId: up.publicId, isPrimary: product.images.length === 0, sortOrder: product.images.length },
  });
  res.status(201).json({ image });
});
sellerRouter.put("/products/:id/images/:imageId/primary", seller, async (req, res) => {
  const store = await myStore(req.user!.id);
  const product = await prisma.product.findFirst({ where: { id: req.params.id, storeId: store!.id }, include: { images: { orderBy: { sortOrder: "asc" } } } });
  const target = product?.images.find((i) => i.id === req.params.imageId);
  if (!product || !target) return res.status(404).json({ error: "Image not found" });
  // Primary image goes first (sortOrder 0) because the storefront shows the first image.
  const ordered = [target, ...product.images.filter((i) => i.id !== target.id)];
  await prisma.$transaction(ordered.map((img, idx) => prisma.productImage.update({ where: { id: img.id }, data: { sortOrder: idx, isPrimary: idx === 0 } })));
  res.status(204).end();
});
sellerRouter.delete("/products/:id/images/:imageId", seller, async (req, res) => {
  const store = await myStore(req.user!.id);
  const img = await prisma.productImage.findFirst({ where: { id: req.params.imageId, productId: req.params.id, product: { storeId: store!.id } } });
  if (!img) return res.status(404).json({ error: "Image not found" });
  await prisma.productImage.delete({ where: { id: img.id } });
  if (img.isPrimary) {
    const next = await prisma.productImage.findFirst({ where: { productId: img.productId }, orderBy: { sortOrder: "asc" } });
    if (next) await prisma.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
  }
  if (img.publicId) await deleteFromCloudinary(img.publicId);
  res.status(204).end();
});

// ---- Orders (sub-orders for this store only) ----
sellerRouter.get("/orders", seller, async (req, res) => {
  const store = await myStore(req.user!.id);
  const fulfillments = await prisma.sellerFulfillment.findMany({
    where: { storeId: store!.id }, orderBy: { updatedAt: "desc" },
    include: { items: true, order: { select: { id: true, createdAt: true, address: { select: { line1: true, line2: true, city: true, pincode: true, phone: true } }, payments: { select: { method: true, status: true } } } } },
  });
  res.json({ fulfillments });
});

const NEXT: Record<string, string[]> = { PENDING: ["CONFIRMED", "REJECTED"], CONFIRMED: ["PACKED"], PACKED: ["HANDED_OVER"] };
const statusSchema = z.object({ status: z.enum(["CONFIRMED", "REJECTED", "PACKED", "HANDED_OVER"]) });
sellerRouter.patch("/fulfillments/:id/status", seller, async (req, res) => {
  const p = statusSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid status" });
  const store = await myStore(req.user!.id);
  const f = await prisma.sellerFulfillment.findFirst({ where: { id: req.params.id, storeId: store!.id }, include: { items: true } });
  if (!f) return res.status(404).json({ error: "Order not found" });
  if (!(NEXT[f.status] ?? []).includes(p.data.status)) return res.status(409).json({ error: `Cannot change ${f.status} to ${p.data.status}` });
  if (p.data.status === "CONFIRMED") {
    const online = await prisma.payment.findFirst({ where: { orderId: f.orderId, method: "ONLINE" } });
    if (online && online.status !== "SUCCESS") return res.status(409).json({ error: "Customer has not completed the online payment yet" });
  }
  await prisma.$transaction(async (tx) => {
    // Conditional update: a double click / race cannot apply the transition (or restock) twice.
    const r = await tx.sellerFulfillment.updateMany({ where: { id: f.id, status: f.status }, data: { status: p.data.status } });
    if (r.count === 0) throw new Error("STALE");
    if (p.data.status === "REJECTED") {
      for (const i of f.items) await tx.product.update({ where: { id: i.productId }, data: { stock: { increment: i.quantity } } });
    }
    await syncOrderStatus(tx, f.orderId);
  }).catch((e) => { if (e.message === "STALE") return res.status(409).json({ error: "Order was just updated, refresh" }); throw e; });
  if (!res.headersSent) res.json({ ok: true });
});
