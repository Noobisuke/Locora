// End-to-end smoke test against a RUNNING, SEEDED Locora API. Use a DEVELOPMENT database only (it creates test users/products).
// Run:  npm run smoke      (API_URL defaults to http://localhost:4000/api)
const API = process.env.API_URL ?? "http://localhost:4000/api";
const ADMIN = { email: process.env.SEED_ADMIN_EMAIL ?? "admin@locora.local", password: process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!" };
const PW = "Password123!";
const run = Date.now();
let pass = 0, fail = 0;

async function call(method, path, { token, body } = {}) {
  const res = await fetch(API + path, {
    method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  return { status: res.status, data };
}
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log("  PASS", name); } else { fail++; console.log("  FAIL", name, detail ? `-> ${detail}` : ""); }
}
const section = (t) => console.log(`\n== ${t}`);
async function mkUser(prefix) {
  const email = `${prefix}-${run}-${Math.random().toString(36).slice(2, 6)}@smoke.test`;
  const r = await call("POST", "/auth/register", { body: { name: `Smoke ${prefix}`, email, password: PW } });
  if (r.status !== 201) throw new Error(`register failed (${r.status}): ${JSON.stringify(r.data)}`);
  return { token: r.data.token, id: r.data.user.id, email };
}
const ADDR = { label: "Home", line1: "12 Test Street", city: "Ludhiana", state: "Punjab", pincode: "141001", phone: "9876543210" };

try {
  section("Health & auth");
  const h = await call("GET", "/health");
  check("health endpoint reports database up", h.status === 200 && h.data.database === "up", JSON.stringify(h.data));
  const esc = await call("POST", "/auth/register", { body: { name: "Evil", email: `evil-${run}@smoke.test`, password: PW, role: "ADMIN" } });
  check("signup cannot grant ADMIN role", esc.status === 201 && esc.data.user.role === "CUSTOMER", JSON.stringify(esc.data));
  const c = await mkUser("cust");
  check("wrong password rejected", (await call("POST", "/auth/login", { body: { email: c.email, password: "nope-nope" } })).status === 401);
  const me = await call("GET", "/auth/me", { token: c.token });
  check("/auth/me returns the user", me.status === 200 && me.data.user?.email === c.email);

  section("Browse");
  const list = await call("GET", "/products");
  check("product list returns seeded products", list.status === 200 && list.data.total >= 1, `total=${list.data.total}`);
  const prod = list.data.products.find((p) => p.stock >= 5);
  check("found an in-stock seeded product (run `npm run db:seed`)", !!prod);
  if (!prod) throw new Error("No seeded in-stock product; cannot continue");
  const stockBefore = prod.stock, price = prod.pricePaise;

  section("Cart, order, stock");
  check("cart requires login", (await call("GET", "/cart")).status === 401);
  const cart = await call("PUT", "/cart/items", { token: c.token, body: { productId: prod.id, quantity: 2 } });
  const sub = price * 2, fee = sub >= 49900 ? 0 : 4000;
  check("cart subtotal/delivery/total computed by server", cart.data.subtotalPaise === sub && cart.data.deliveryFeePaise === fee && cart.data.totalPaise === sub + fee, JSON.stringify(cart.data));
  check("cannot put more than stock in cart", (await call("PUT", "/cart/items", { token: c.token, body: { productId: prod.id, quantity: stockBefore + 1 } })).status === 409);
  await call("PUT", "/cart/items", { token: c.token, body: { productId: prod.id, quantity: 2 } });
  check("invalid pincode rejected", (await call("POST", "/addresses", { token: c.token, body: { ...ADDR, pincode: "12" } })).status === 400);
  const addr = await call("POST", "/addresses", { token: c.token, body: ADDR });
  check("valid address saved", addr.status === 201);
  const key = `smoke-key-${run}`;
  const ord = await call("POST", "/orders", { token: c.token, body: { addressId: addr.data.address.id, paymentMethod: "COD", idempotencyKey: key } });
  check("order created", ord.status === 201, JSON.stringify(ord.data));
  if (ord.status !== 201) throw new Error("Order creation failed, stopping: " + JSON.stringify(ord.data));
  check("order total matches server calculation", ord.data.order?.totalPaise === sub + fee);
  check("order item keeps price paid", ord.data.order?.items[0]?.unitPricePaise === price && ord.data.order.items[0].quantity === 2);
  const again = await call("POST", "/orders", { token: c.token, body: { addressId: addr.data.address.id, paymentMethod: "COD", idempotencyKey: key } });
  check("same idempotency key returns SAME order (no duplicate)", again.data.duplicate === true && again.data.order?.id === ord.data.order?.id);
  const after = await call("GET", `/products/${prod.id}`);
  check("stock reduced by ordered quantity", after.data.product.stock === stockBefore - 2, `stock=${after.data.product.stock}`);
  check("cart emptied after order", (await call("GET", "/cart", { token: c.token })).data.items.length === 0);
  check("order appears in history", (await call("GET", "/orders", { token: c.token })).data.orders.some((o) => o.id === ord.data.order.id));
  const canc = await call("POST", `/orders/${ord.data.order.id}/cancel`, { token: c.token });
  check("customer can cancel a pending order", canc.status === 200 && canc.data.order.status === "CANCELLED");
  check("cancel restores stock", (await call("GET", `/products/${prod.id}`)).data.product.stock === stockBefore);
  check("cancelling twice is rejected (no double restock)", (await call("POST", `/orders/${ord.data.order.id}/cancel`, { token: c.token })).status === 409);

  section("Access control");
  check("customer blocked from seller API", (await call("GET", "/seller/products", { token: c.token })).status === 403);
  check("customer blocked from admin API", (await call("GET", "/admin/dashboard", { token: c.token })).status === 403);
  check("customer blocked from delivery API", (await call("GET", "/delivery", { token: c.token })).status === 403);
  check("no token -> 401 on admin API", (await call("GET", "/admin/dashboard")).status === 401);

  section("Seller application & product management");
  const s = await mkUser("seller");
  check("unapproved user cannot create products", (await call("POST", "/seller/products", { token: s.token, body: {} })).status === 403);
  const ap = await call("POST", "/seller/apply", { token: s.token, body: { storeName: `Smoke Store ${run}`, contactPhone: "9876543210", address: "1 Market Road", serviceArea: "Ludhiana" } });
  check("seller application submitted", ap.status === 201);
  check("duplicate pending application rejected", (await call("POST", "/seller/apply", { token: s.token, body: { storeName: "X Store", contactPhone: "9876543210", address: "1 Market Road", serviceArea: "Ludhiana" } })).status === 409);
  const adm = await call("POST", "/auth/login", { body: ADMIN });
  check("admin can log in (seeded dev admin)", adm.status === 200 && adm.data.user.role === "ADMIN", JSON.stringify(adm.data));
  const A = adm.data.token;
  const apps = await call("GET", "/admin/seller-applications?status=PENDING", { token: A });
  const mine = apps.data.applications?.find((x) => x.id === ap.data.application.id);
  check("admin sees the pending application", !!mine);
  check("admin approves application", (await call("POST", `/admin/seller-applications/${ap.data.application.id}/review`, { token: A, body: { decision: "APPROVED" } })).status === 200);
  check("application cannot be reviewed twice", (await call("POST", `/admin/seller-applications/${ap.data.application.id}/review`, { token: A, body: { decision: "REJECTED" } })).status === 409);
  const s2 = await call("POST", "/auth/login", { body: { email: s.email, password: PW } });
  check("approved user is now SELLER", s2.data.user?.role === "SELLER");
  const cats = (await call("GET", "/categories")).data.categories;
  const base = { name: `Smoke Item ${run}`, description: "Smoke test product", categoryId: cats[0].id, pricePaise: 15000, stock: 1, isActive: true };
  check("invalid product (price too low) rejected", (await call("POST", "/seller/products", { token: s.token, body: { ...base, pricePaise: 5 } })).status === 400);
  const np = await call("POST", "/seller/products", { token: s.token, body: base });
  check("approved seller creates product", np.status === 201, JSON.stringify(np.data));
  const pid = np.data.product.id;
  check("seller updates own product", (await call("PUT", `/seller/products/${pid}`, { token: s.token, body: { ...base, description: "Updated description" } })).status === 200);
  const other = await call("POST", "/auth/login", { body: { email: "sample-seller@locora.local", password: "SampleSeller123!" } });
  if (other.status === 200) check("another seller CANNOT edit this product", (await call("PUT", `/seller/products/${pid}`, { token: other.data.token, body: base })).status === 404);
  else console.log("  SKIP other-seller isolation (seeded sample seller not found)");
  check("new product visible in public marketplace", (await call("GET", `/products?q=${encodeURIComponent(base.name)}`)).data.products.some((p) => p.id === pid));
  const fd = new FormData(); fd.append("image", new Blob(["not an image"], { type: "image/png" }), "fake.png");
  const up = await fetch(`${API}/seller/products/${pid}/images`, { method: "POST", headers: { Authorization: `Bearer ${s.token}` }, body: fd });
  check("fake image rejected (400) or storage-not-configured (503)", up.status === 400 || up.status === 503, `status=${up.status}`);

  section("Race: 5 buyers, 1 unit in stock");
  const buyers = [];
  for (let i = 0; i < 5; i++) {
    const b = await mkUser(`racer${i}`);
    b.addr = (await call("POST", "/addresses", { token: b.token, body: ADDR })).data.address.id;
    await call("PUT", "/cart/items", { token: b.token, body: { productId: pid, quantity: 1 } });
    buyers.push(b);
  }
  const results = await Promise.all(buyers.map((b) => call("POST", "/orders", { token: b.token, body: { addressId: b.addr, paymentMethod: "COD" } })));
  const wins = results.filter((r) => r.status === 201), losses = results.filter((r) => r.status === 409);
  check("exactly ONE order succeeds", wins.length === 1, `successes=${wins.length}`);
  check("the other four are refused with 409", losses.length === 4, `409s=${losses.length}`);
  check("stock is exactly 0 (never negative)", (await call("GET", `/products/${pid}`)).data.product.stock === 0);
  const winner = buyers[results.indexOf(wins[0])], orderId = wins[0].data.order.id;

  section("Seller fulfillment & delivery");
  const so = await call("GET", "/seller/orders", { token: s.token });
  const ful = so.data.fulfillments?.find((f) => f.orderId === orderId);
  check("seller sees the order containing their product", !!ful);
  check("illegal jump PENDING -> HANDED_OVER refused", (await call("PATCH", `/seller/fulfillments/${ful.id}/status`, { token: s.token, body: { status: "HANDED_OVER" } })).status === 409);
  check("seller confirms", (await call("PATCH", `/seller/fulfillments/${ful.id}/status`, { token: s.token, body: { status: "CONFIRMED" } })).status === 200);
  check("seller marks packed", (await call("PATCH", `/seller/fulfillments/${ful.id}/status`, { token: s.token, body: { status: "PACKED" } })).status === 200);
  const dp = await mkUser("deliv");
  check("admin makes a delivery partner", (await call("PATCH", `/admin/users/${dp.id}/delivery-partner`, { token: A, body: { enabled: true } })).status === 200);
  check("admin assigns delivery", (await call("POST", `/admin/fulfillments/${ful.id}/assign`, { token: A, body: { partnerId: dp.id } })).status === 201);
  const dl = await call("GET", "/delivery", { token: dp.token });
  check("partner sees exactly their assignment", dl.data.deliveries?.length === 1);
  const did = dl.data.deliveries[0].id;
  check("cannot skip to DELIVERED", (await call("PATCH", `/delivery/${did}/status`, { token: dp.token, body: { status: "DELIVERED" } })).status === 409);
  for (const st of ["PICKED_UP", "IN_PROGRESS", "DELIVERED"]) check(`delivery -> ${st}`, (await call("PATCH", `/delivery/${did}/status`, { token: dp.token, body: { status: st } })).status === 200);
  const fin = await call("GET", `/orders/${orderId}`, { token: winner.token });
  check("order is DELIVERED", fin.data.order?.status === "DELIVERED");
  check("COD payment marked SUCCESS on delivery", fin.data.order?.payments[0]?.status === "SUCCESS");

  section("Reviews & password reset");
  check("non-buyer cannot review", (await call("POST", `/products/${pid}/reviews`, { token: c.token, body: { rating: 5 } })).status === 403);
  check("invalid rating rejected", (await call("POST", `/products/${pid}/reviews`, { token: winner.token, body: { rating: 9 } })).status === 400);
  check("buyer of a DELIVERED order can review", (await call("POST", `/products/${pid}/reviews`, { token: winner.token, body: { rating: 4, comment: "Good" } })).status === 201);
  const rv = await call("GET", `/products/${pid}/reviews`);
  check("review average and count are shown", rv.data.count === 1 && rv.data.average === 4);
  const fp = await call("POST", "/auth/forgot-password", { body: { email: c.email } });
  check("forgot-password clearly says email is not configured (503)", fp.status === 503);
  check("reset with bad token rejected", (await call("POST", "/auth/reset-password", { body: { token: "x".repeat(40), password: "NewPassword123!" } })).status === 400);

  await call("DELETE", `/seller/products/${pid}`, { token: s.token }); // hide test product from the storefront
  console.log("\n(Test users and orders remain in your DEVELOPMENT database. Never run this against production.)");
} catch (e) {
  fail++; console.log("\nFATAL:", e.message);
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
