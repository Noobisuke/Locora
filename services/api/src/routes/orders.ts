import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { calcTotals } from "../lib/pricing";
import { razorpayConfigured } from "./payments";

export const orderRouter = Router();
orderRouter.use(requireAuth);

class OrderError extends Error { constructor(public status: number, message: string) { super(message); } }

const createSchema = z.object({
  addressId: z.string().min(1),
  paymentMethod: z.enum(["COD", "ONLINE"]), // ONLINE only works when Razorpay keys are configured
  idempotencyKey: z.string().min(8).max(100).optional(),
});

const orderInclude = {
  items: true, payments: true, address: true,
  fulfillments: { include: { store: { select: { id: true, name: true } }, delivery: { select: { status: true } } } },
} satisfies Prisma.OrderInclude;

// Place an order from the server-side cart. The client sends NO prices or totals.
orderRouter.post("/", async (req, res) => {
  const p = createSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input", details: p.error.flatten().fieldErrors });
  const userId = req.user!.id;
  const { addressId, idempotencyKey, paymentMethod } = p.data;
  if (paymentMethod === "ONLINE" && !razorpayConfigured()) return res.status(503).json({ error: "Online payment is not available right now. Choose cash on delivery." });

  // Retried request with the same key returns the original order instead of creating a duplicate.
  if (idempotencyKey) {
    const existing = await prisma.order.findFirst({ where: { idempotencyKey, userId }, include: orderInclude });
    if (existing) return res.status(200).json({ order: existing, duplicate: true });
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const address = await tx.address.findFirst({ where: { id: addressId, userId } });
      if (!address) throw new OrderError(400, "Delivery address not found");

      const cart = await tx.cart.findUnique({ where: { userId }, include: { items: { include: { product: true } } } });
      if (!cart || cart.items.length === 0) throw new OrderError(400, "Your cart is empty");

      // 1) Atomically reserve stock. The WHERE stock >= qty makes this safe under concurrent orders:
      //    if two buyers race for the last unit, only one UPDATE matches a row.
      for (const item of cart.items) {
        const prod = item.product;
        if (!prod.isActive || prod.moderationBlocked) throw new OrderError(409, `"${prod.name}" is no longer available`);
        const r = await tx.product.updateMany({
          where: { id: prod.id, isActive: true, moderationBlocked: false, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (r.count === 0) throw new OrderError(409, `Not enough stock for "${prod.name}"`);
      }

      // 2) Totals from DB prices (re-read inside the transaction), never from the client.
      const subtotal = cart.items.reduce((s, i) => s + i.product.pricePaise * i.quantity, 0);
      const totals = calcTotals(subtotal);
      const created = await tx.order.create({
        data: { userId, addressId, idempotencyKey, ...totals },
      });

      // 3) One seller fulfillment (sub-order) per store; items keep the price paid at purchase time.
      const byStore = new Map<string, typeof cart.items>();
      for (const i of cart.items) byStore.set(i.product.storeId, [...(byStore.get(i.product.storeId) ?? []), i]);
      for (const [storeId, items] of byStore) {
        const f = await tx.sellerFulfillment.create({
          data: { orderId: created.id, storeId, subtotalPaise: items.reduce((s, i) => s + i.product.pricePaise * i.quantity, 0) },
        });
        await tx.orderItem.createMany({
          data: items.map((i) => ({
            orderId: created.id, fulfillmentId: f.id, productId: i.productId,
            productName: i.product.name, unitPricePaise: i.product.pricePaise, quantity: i.quantity,
          })),
        });
      }

      await tx.payment.create({ data: { orderId: created.id, method: paymentMethod, amountPaise: totals.totalPaise } });
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return tx.order.findUniqueOrThrow({ where: { id: created.id }, include: orderInclude });
    });
    res.status(201).json({ order });
  } catch (e) {
    if (e instanceof OrderError) return res.status(e.status).json({ error: e.message });
    // Unique idempotency key hit by a simultaneous duplicate request
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && idempotencyKey) {
      const existing = await prisma.order.findFirst({ where: { idempotencyKey, userId }, include: orderInclude });
      if (existing) return res.status(200).json({ order: existing, duplicate: true });
    }
    throw e;
  }
});

orderRouter.get("/", async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user!.id }, orderBy: { createdAt: "desc" }, include: orderInclude,
  });
  res.json({ orders });
});

orderRouter.get("/:id", async (req, res) => {
  const order = await prisma.order.findFirst({ where: { id: req.params.id, userId: req.user!.id }, include: orderInclude });
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({ order });
});

// Customer cancellation: only while every seller fulfillment is still PENDING (nobody has confirmed yet).
orderRouter.post("/:id/cancel", async (req, res) => {
  try {
    const order = await prisma.$transaction(async (tx) => {
      const o = await tx.order.findFirst({ where: { id: req.params.id, userId: req.user!.id }, include: { items: true, fulfillments: true } });
      if (!o) throw new OrderError(404, "Order not found");
      const paid = await tx.payment.count({ where: { orderId: o.id, method: "ONLINE", status: "SUCCESS" } });
      if (paid > 0) throw new OrderError(409, "This order is already paid online. Refunds are not automated yet; please contact support.");
      if (o.status !== "PENDING" || o.fulfillments.some((f) => f.status !== "PENDING"))
        throw new OrderError(409, "This order can no longer be cancelled");
      // Conditional update guards against a double-cancel race restoring stock twice.
      const flipped = await tx.order.updateMany({ where: { id: o.id, status: "PENDING" }, data: { status: "CANCELLED" } });
      if (flipped.count === 0) throw new OrderError(409, "This order can no longer be cancelled");
      await tx.sellerFulfillment.updateMany({ where: { orderId: o.id }, data: { status: "CANCELLED" } });
      for (const i of o.items) await tx.product.update({ where: { id: i.productId }, data: { stock: { increment: i.quantity } } });
      await tx.payment.updateMany({ where: { orderId: o.id, status: "PENDING" }, data: { status: "FAILED" } });
      return tx.order.findUniqueOrThrow({ where: { id: o.id }, include: orderInclude });
    });
    res.json({ order });
  } catch (e) {
    if (e instanceof OrderError) return res.status(e.status).json({ error: e.message });
    throw e;
  }
});
