import { api } from "./api";

declare global { interface Window { Razorpay?: any } }

function loadScript(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js"; // official Razorpay checkout
    s.onload = () => resolve(true); s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// Opens Razorpay's official checkout for an existing PENDING online order.
// Success is only trusted after OUR server verifies the signature.
export async function payOnline(orderId: string, user: { name: string; email: string }): Promise<"paid" | "dismissed"> {
  const init = await api<{ keyId: string; razorpayOrderId: string; amountPaise: number; currency: string }>("/payments/razorpay/create", { method: "POST", body: { orderId } });
  if (!(await loadScript())) throw new Error("Could not load Razorpay checkout. Check your internet connection.");
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: init.keyId, amount: init.amountPaise, currency: init.currency, order_id: init.razorpayOrderId,
      name: "Locora", description: `Order ${orderId.slice(-8).toUpperCase()}`, prefill: { name: user.name, email: user.email },
      theme: { color: "#0f766e" },
      handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        try { await api("/payments/razorpay/verify", { method: "POST", body: resp }); resolve("paid"); } catch (e) { reject(e); }
      },
      modal: { ondismiss: () => resolve("dismissed") },
    });
    rzp.on("payment.failed", () => { /* customer can retry inside the popup */ });
    rzp.open();
  });
}
