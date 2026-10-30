import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

export const deliveryRouter = Router();
deliveryRouter.use(requireAuth, requireRole("DELIVERY"));
// Role alone is not enough: the partner must also be approved by an admin.
deliveryRouter.use(async (req, res, next) => {
  const me = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!me?.deliveryApproved) return res.status(403).json({ error: "Your delivery account is not approved" });
  next();
});

// Partners see only their OWN assignments, with address/items/COD amount, but nothing they could use to edit payments.
deliveryRouter.get("/", async (req, res) => {
  const deliveries = await prisma.delivery.findMany({
    where: { partnerId: req.user!.id }, orderBy: { updatedAt: "desc" },
    include: { fulfillment: { select: { subtotalPaise: true, items: { select: { productName: true, quantity: true } },
      store: { select: { name: true, address: true, contactPhone: true } },
      order: { select: { id: true, address: true, payments: { select: { method: true, status: true } } } } } } },
  });
  res.json({ deliveries });
});

const NEXT: Record<string, string[]> = { ASSIGNED: ["PICKED_UP"], PICKED_UP: ["IN_PROGRESS"], IN_PROGRESS: ["DELIVERED", "FAILED"] };
deliveryRouter.patch("/:id/status", async (req, res) => {
  const p = z.object({ status: z.enum(["PICKED_UP", "IN_PROGRESS", "DELIVERED", "FAILED"]) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid status" });
  const d = await prisma.delivery.findFirst({ where: { id: req.params.id, partnerId: req.user!.id }, include: { fulfillment: true } });
  if (!d) return res.status(404).json({ error: "Delivery not found" });
  if (!(NEXT[d.status] ?? []).includes(p.data.status)) return res.status(409).json({ error: `Cannot change ${d.status} to ${p.data.status}` });
  const done = await prisma.$transaction(async (tx) => {
    const r = await tx.delivery.updateMany({ where: { id: d.id, status: d.status }, data: { status: p.data.status } });
    if (r.count === 0) return false;
    const orderId = d.fulfillment.orderId;
    if (p.data.status === "PICKED_UP" || p.data.status === "IN_PROGRESS") {
      await tx.order.updateMany({ where: { id: orderId, status: { in: ["CONFIRMED", "PROCESSING"] } }, data: { status: "OUT_FOR_DELIVERY" } });
    }
    if (p.data.status === "DELIVERED") {
      // Order becomes DELIVERED only when every live sub-order has been delivered.
      const fs = await tx.sellerFulfillment.findMany({ where: { orderId, status: { notIn: ["CANCELLED", "REJECTED"] } }, include: { delivery: true } });
      if (fs.every((f) => f.delivery?.status === "DELIVERED")) {
        await tx.order.update({ where: { id: orderId }, data: { status: "DELIVERED" } });
        await tx.payment.updateMany({ where: { orderId, method: "COD", status: "PENDING" }, data: { status: "SUCCESS" } }); // cash collected
      }
    }
    return true;
  });
  if (!done) return res.status(409).json({ error: "Already updated, refresh" });
  res.json({ ok: true });
});
