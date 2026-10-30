import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { calcTotals } from "../lib/pricing";

export const cartRouter = Router();
export const wishlistRouter = Router();
cartRouter.use(requireAuth);
wishlistRouter.use(requireAuth);

async function buildCart(userId: string) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { orderBy: { id: "asc" }, include: { product: { include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 }, store: { select: { id: true, name: true } } } } } } },
  });
  const items = (cart?.items ?? []).map((i) => {
    const p = i.product;
    const available = p.isActive && !p.moderationBlocked && p.stock > 0;
    return {
      productId: p.id, name: p.name, image: p.images[0]?.url ?? null, store: p.store,
      unitPricePaise: p.pricePaise, quantity: i.quantity, stock: p.stock, available,
      // Warn the UI if stock dropped below what is in the cart. The server re-checks at order time anyway.
      problem: !available ? "Unavailable" : i.quantity > p.stock ? `Only ${p.stock} left` : null,
      linePaise: p.pricePaise * i.quantity,
    };
  });
  const subtotal = items.filter((i) => !i.problem).reduce((s, i) => s + i.linePaise, 0);
  return { items, ...calcTotals(subtotal) };
}

cartRouter.get("/", async (req, res) => res.json(await buildCart(req.user!.id)));

// Set an absolute quantity. quantity 0 removes the item.
const setSchema = z.object({ productId: z.string().min(1), quantity: z.number().int().min(0).max(99) });
cartRouter.put("/items", async (req, res) => {
  const p = setSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input", details: p.error.flatten().fieldErrors });
  const userId = req.user!.id;
  const cart = await prisma.cart.upsert({ where: { userId }, update: {}, create: { userId } });
  if (p.data.quantity === 0) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId: p.data.productId } });
  } else {
    const product = await prisma.product.findFirst({
      where: { id: p.data.productId, isActive: true, moderationBlocked: false, store: { isActive: true } },
    });
    if (!product) return res.status(404).json({ error: "Product not available" });
    if (product.stock < p.data.quantity) return res.status(409).json({ error: `Only ${product.stock} in stock` });
    await prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId: product.id } },
      update: { quantity: p.data.quantity }, create: { cartId: cart.id, productId: product.id, quantity: p.data.quantity },
    });
  }
  res.json(await buildCart(userId));
});

cartRouter.delete("/", async (req, res) => {
  await prisma.cartItem.deleteMany({ where: { cart: { userId: req.user!.id } } });
  res.json(await buildCart(req.user!.id));
});

wishlistRouter.get("/", async (req, res) => {
  const items = await prisma.wishlistItem.findMany({
    where: { userId: req.user!.id },
    include: { product: { include: { images: { take: 1, orderBy: { sortOrder: "asc" } } } } },
  });
  res.json({ products: items.map((i) => i.product) });
});
wishlistRouter.put("/:productId", async (req, res) => {
  const product = await prisma.product.findFirst({ where: { id: req.params.productId, isActive: true } });
  if (!product) return res.status(404).json({ error: "Product not found" });
  await prisma.wishlistItem.upsert({
    where: { userId_productId: { userId: req.user!.id, productId: product.id } }, update: {},
    create: { userId: req.user!.id, productId: product.id },
  });
  res.status(204).end();
});
wishlistRouter.delete("/:productId", async (req, res) => {
  await prisma.wishlistItem.deleteMany({ where: { userId: req.user!.id, productId: req.params.productId } });
  res.status(204).end();
});
