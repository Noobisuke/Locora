import { Prisma } from "@prisma/client";

// Recompute the parent order status from its seller sub-orders (call inside the same transaction).
export async function syncOrderStatus(tx: Prisma.TransactionClient, orderId: string) {
  const fs = await tx.sellerFulfillment.findMany({ where: { orderId }, select: { status: true } });
  const live = fs.filter((f) => f.status !== "CANCELLED" && f.status !== "REJECTED");
  let status: "PENDING" | "CONFIRMED" | "PROCESSING" | "CANCELLED";
  if (live.length === 0) status = "CANCELLED";
  else if (live.some((f) => f.status === "PACKED" || f.status === "HANDED_OVER")) status = "PROCESSING";
  else if (live.some((f) => f.status === "CONFIRMED")) status = "CONFIRMED";
  else status = "PENDING";
  // Never overwrite later states set by the delivery flow.
  await tx.order.updateMany({ where: { id: orderId, status: { in: ["PENDING", "CONFIRMED", "PROCESSING"] } }, data: { status } });
}
