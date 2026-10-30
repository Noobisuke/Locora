// Delivery fee rule (MVP, business can change): Rs 40 flat, free for subtotal >= Rs 499. All values in paise.
export const FREE_DELIVERY_THRESHOLD_PAISE = 49900;
export const DELIVERY_FEE_PAISE = 4000;

export function calcTotals(subtotalPaise: number) {
  const deliveryFeePaise = subtotalPaise === 0 || subtotalPaise >= FREE_DELIVERY_THRESHOLD_PAISE ? 0 : DELIVERY_FEE_PAISE;
  return { subtotalPaise, deliveryFeePaise, totalPaise: subtotalPaise + deliveryFeePaise };
}
