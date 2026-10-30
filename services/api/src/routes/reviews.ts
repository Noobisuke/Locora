import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";

export const reviewRouter = Router();

reviewRouter.get("/products/:id/reviews", async (req, res) => {
  const reviews = await prisma.review.findMany({ where: { productId: req.params.id }, orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { name: true } } } });
  const agg = await prisma.review.aggregate({ where: { productId: req.params.id }, _avg: { rating: true }, _count: true });
  res.json({
    average: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null, count: agg._count,
    reviews: reviews.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, createdAt: r.createdAt, name: r.user.name.split(" ")[0] })),
  });
});

const schema = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(500).optional() });
// Only customers who actually RECEIVED the product (order DELIVERED) can review it. One review per user per product.
reviewRouter.post("/products/:id/reviews", requireAuth, async (req, res) => {
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input", details: p.error.flatten().fieldErrors });
  const bought = await prisma.orderItem.findFirst({ where: { productId: req.params.id, order: { userId: req.user!.id, status: "DELIVERED" } } });
  if (!bought) return res.status(403).json({ error: "Only customers who received this product can review it" });
  const review = await prisma.review.upsert({
    where: { userId_productId: { userId: req.user!.id, productId: req.params.id } },
    update: { rating: p.data.rating, comment: p.data.comment }, create: { userId: req.user!.id, productId: req.params.id, rating: p.data.rating, comment: p.data.comment },
  });
  res.status(201).json({ review });
});
