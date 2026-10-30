import { prisma } from "../db";

// Abandoned online orders would hold stock forever. Cancel unpaid ONLINE orders after 30 minutes and return the stock.
export async function expireUnpaidOrders() {
  const cutoff = new Date(Date.now() - 30 * 60_000);
  const stale = await prisma.order.findMany({
    where: { status: "PENDING", createdAt: { lt: cutoff }, payments: { some: { method: "ONLINE", status: "PENDING" } } },
    select: { id: true },
  });
  for (const { id } of stale) {
    await prisma.$transaction(async (tx) => {
      const flipped = await tx.order.updateMany({ where: { id, status: "PENDING", payments: { none: { status: "SUCCESS" } } }, data: { status: "CANCELLED" } });
      if (flipped.count === 0) return; // paid or changed in the meantime
      const items = await tx.orderItem.findMany({ where: { orderId: id } });
      await tx.sellerFulfillment.updateMany({ where: { orderId: id }, data: { status: "CANCELLED" } });
      for (const i of items) await tx.product.update({ where: { id: i.productId }, data: { stock: { increment: i.quantity } } });
      await tx.payment.updateMany({ where: { orderId: id, status: "PENDING" }, data: { status: "FAILED" } });
    }).catch((e) => console.error("expire failed for", id, e));
  }
}
