import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";

export const catalogRouter = Router();

catalogRouter.get("/categories", async (_req, res) => {
  res.json({ categories: await prisma.category.findMany({ orderBy: { name: "asc" } }) });
});

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().optional(), // category slug
  minPrice: z.coerce.number().int().min(0).optional(), // paise
  maxPrice: z.coerce.number().int().min(0).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

// Public listing: only active, non-blocked products from active stores.
catalogRouter.get("/products", async (req, res) => {
  const p = listSchema.safeParse(req.query);
  if (!p.success) return res.status(400).json({ error: "Invalid query", details: p.error.flatten().fieldErrors });
  const { q, category, minPrice, maxPrice, sort, page, pageSize } = p.data;
  const where: Prisma.ProductWhereInput = {
    isActive: true, moderationBlocked: false, store: { isActive: true },
    ...(q && { name: { contains: q, mode: "insensitive" } }),
    ...(category && { category: { slug: category } }),
    ...((minPrice !== undefined || maxPrice !== undefined) && { pricePaise: { gte: minPrice, lte: maxPrice } }),
  };
  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sort === "price_asc" ? { pricePaise: "asc" } : sort === "price_desc" ? { pricePaise: "desc" } : { createdAt: "desc" };
  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where, orderBy, skip: (page - 1) * pageSize, take: pageSize,
      include: { images: { orderBy: { sortOrder: "asc" } }, store: { select: { id: true, name: true } }, category: true },
    }),
  ]);
  res.json({ total, page, pageSize, products });
});

catalogRouter.get("/products/:id", async (req, res) => {
  const product = await prisma.product.findFirst({
    where: { id: req.params.id, isActive: true, moderationBlocked: false, store: { isActive: true } },
    include: { images: { orderBy: { sortOrder: "asc" } }, store: true, category: true },
  });
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json({ product });
});
