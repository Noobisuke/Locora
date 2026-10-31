import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";

const prisma = new PrismaClient();

// Product pictures are generated SVGs (gradient + emoji), so the demo needs no image hosting or internet access.
const PALETTE: Record<string, [string, string]> = {
  grocery: ["#dcfce7", "#4ade80"], fashion: ["#ffe4e6", "#fb7185"], electronics: ["#dbeafe", "#60a5fa"],
  "home-kitchen": ["#ffedd5", "#fb923c"], beauty: ["#fae8ff", "#d946ef"], "books-stationery": ["#e0e7ff", "#818cf8"],
};
function artwork(emoji: string, cat: string): string {
  const [from, to] = PALETTE[cat] ?? ["#f1f5f9", "#94a3b8"];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/><circle cx="500" cy="100" r="150" fill="#fff" fill-opacity=".25"/><circle cx="80" cy="540" r="190" fill="#fff" fill-opacity=".18"/><ellipse cx="300" cy="490" rx="150" ry="22" fill="#000" fill-opacity=".10"/><text x="300" y="360" font-size="260" text-anchor="middle" font-family="Segoe UI Emoji,Apple Color Emoji,Noto Color Emoji,sans-serif">${emoji}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
type Item = { cat: string; name: string; emoji: string; price: number; was?: number; stock: number; desc: string; feat?: boolean; alias?: string };
const CATALOG: Item[] = [
  // Grocery
  { cat: "grocery", name: "Basmati Rice 1kg", alias: "Sample Basmati Rice 1kg", emoji: "🍚", price: 120, was: 140, stock: 50, feat: true, desc: "Long-grain aged basmati. Fluffy, aromatic rice for everyday meals and biryani." },
  { cat: "grocery", name: "Assam Tea 250g", alias: "Sample Tea 250g", emoji: "🍵", price: 90, stock: 30, desc: "Strong, malty CTC tea leaves. Makes a proper cup of masala chai." },
  { cat: "grocery", name: "Wild Forest Honey 500g", alias: "Sample Honey 500g", emoji: "🍯", price: 250, stock: 0, desc: "Raw, unprocessed honey collected from forest hives." },
  { cat: "grocery", name: "Fresh Cow Milk 1L", emoji: "🥛", price: 62, stock: 40, desc: "Pasteurised full-cream milk, delivered fresh from the local dairy." },
  { cat: "grocery", name: "Whole Wheat Atta 5kg", emoji: "🌾", price: 245, was: 270, stock: 35, desc: "Stone-ground whole wheat flour for soft rotis and parathas." },
  { cat: "grocery", name: "Mixed Dry Fruits 500g", emoji: "🥜", price: 520, was: 600, stock: 20, feat: true, desc: "Almonds, cashews, raisins and pistachios in one festive-ready pack." },
  { cat: "grocery", name: "Farm Fresh Eggs (12)", emoji: "🥚", price: 96, stock: 3, desc: "A dozen farm eggs, collected daily." },
  { cat: "grocery", name: "Desi Ghee 500ml", emoji: "🧈", price: 360, was: 399, stock: 25, desc: "Traditional slow-cooked ghee with a rich aroma." },
  // Fashion
  { cat: "fashion", name: "Men's Cotton T-Shirt", emoji: "👕", price: 499, was: 799, stock: 60, feat: true, desc: "Soft 100% cotton crew-neck tee. Breathable and easy to wash." },
  { cat: "fashion", name: "Women's Printed Kurti", emoji: "👗", price: 899, was: 1299, stock: 25, desc: "Lightweight printed kurti, a comfortable fit for daily wear." },
  { cat: "fashion", name: "Slim Fit Blue Jeans", emoji: "👖", price: 1199, was: 1799, stock: 40, desc: "Stretch denim in a modern slim fit with a classic wash." },
  { cat: "fashion", name: "Running Sneakers", emoji: "👟", price: 1799, was: 2499, stock: 18, feat: true, desc: "Cushioned, lightweight sneakers for running and the gym." },
  { cat: "fashion", name: "Classic Leather Handbag", emoji: "👜", price: 1499, was: 1999, stock: 14, desc: "Roomy faux-leather handbag with a zip pocket and sturdy straps." },
  { cat: "fashion", name: "Cotton Baseball Cap", emoji: "🧢", price: 299, stock: 70, desc: "Adjustable cotton cap with a curved brim." },
  { cat: "fashion", name: "Aviator Sunglasses", emoji: "🕶️", price: 699, was: 999, stock: 30, desc: "UV-protected lenses in a lightweight metal frame." },
  { cat: "fashion", name: "Woolen Winter Scarf", emoji: "🧣", price: 399, stock: 5, desc: "Warm, soft woolen scarf for the Punjab winter." },
  // Electronics
  { cat: "electronics", name: "Wireless Earbuds", emoji: "🎧", price: 1499, was: 2999, stock: 45, feat: true, desc: "Bluetooth 5.3 earbuds with a charging case and up to 24 hours of playtime." },
  { cat: "electronics", name: "20W Fast Charger", emoji: "🔌", price: 799, was: 1199, stock: 80, desc: "Compact fast charger with USB-C output. Works with most phones." },
  { cat: "electronics", name: "Smart Watch", emoji: "⌚", price: 2499, was: 3999, stock: 22, feat: true, desc: "AMOLED display, heart-rate and sleep tracking, 7-day battery." },
  { cat: "electronics", name: "Bluetooth Speaker", emoji: "🔊", price: 1299, was: 1999, stock: 30, desc: "Portable speaker with deep bass and a splash-proof body." },
  { cat: "electronics", name: "Power Bank 20000mAh", emoji: "🔋", price: 1699, was: 2199, stock: 28, desc: "High-capacity power bank with dual USB output." },
  { cat: "electronics", name: "Wireless Mouse", emoji: "🖱️", price: 499, was: 799, stock: 70, desc: "Silent-click wireless mouse with a USB nano receiver." },
  { cat: "electronics", name: "LED Desk Lamp", emoji: "💡", price: 899, was: 1299, stock: 4, desc: "Dimmable LED lamp with three colour temperatures." },
  { cat: "electronics", name: "Mechanical Keyboard", emoji: "⌨️", price: 2199, was: 2999, stock: 15, desc: "Compact mechanical keyboard with tactile switches." },
  // Home & Kitchen
  { cat: "home-kitchen", name: "Non-stick Frying Pan", emoji: "🍳", price: 799, was: 1199, stock: 35, feat: true, desc: "26cm non-stick pan with a cool-touch handle, induction friendly." },
  { cat: "home-kitchen", name: "Insulated Steel Bottle 1L", emoji: "🥤", price: 599, was: 899, stock: 50, desc: "Keeps drinks cold for 24 hours and hot for 12." },
  { cat: "home-kitchen", name: "Cotton Bedsheet Set", emoji: "🛏️", price: 999, was: 1599, stock: 20, desc: "Double bedsheet with two pillow covers, soft 180 TC cotton." },
  { cat: "home-kitchen", name: "Ceramic Dinner Set", emoji: "🍽️", price: 1899, was: 2599, stock: 12, desc: "18-piece dinner set, microwave and dishwasher safe." },
  { cat: "home-kitchen", name: "Electric Kettle 1.5L", emoji: "☕", price: 899, was: 1299, stock: 33, feat: true, desc: "Stainless steel kettle with auto shut-off and boil-dry protection." },
  { cat: "home-kitchen", name: "Indoor Money Plant", emoji: "🪴", price: 249, stock: 60, desc: "Easy-care money plant in a ceramic pot." },
  { cat: "home-kitchen", name: "Scented Candle Set", emoji: "🕯️", price: 349, was: 499, stock: 45, desc: "Set of 3 soy-wax candles in lavender, vanilla and jasmine." },
  { cat: "home-kitchen", name: "Wooden Wall Clock", emoji: "🕰️", price: 699, stock: 8, desc: "Silent-sweep wall clock with a solid wood frame." },
  // Beauty
  { cat: "beauty", name: "Vitamin C Face Serum", emoji: "🧴", price: 549, was: 799, stock: 40, feat: true, desc: "Brightening serum with 10% vitamin C for an even skin tone." },
  { cat: "beauty", name: "Aloe Vera Gel 200g", emoji: "🌿", price: 199, stock: 70, desc: "Soothing multi-purpose gel for skin and hair." },
  { cat: "beauty", name: "Matte Lipstick", emoji: "💄", price: 349, was: 499, stock: 55, desc: "Long-wear matte lipstick in a rich, smudge-resistant formula." },
  { cat: "beauty", name: "Nourishing Hair Oil 200ml", emoji: "💇", price: 229, stock: 48, desc: "Light herbal hair oil that strengthens and adds shine." },
  { cat: "beauty", name: "Sunscreen SPF 50", emoji: "☀️", price: 399, was: 549, stock: 38, desc: "Lightweight, non-greasy broad-spectrum sun protection." },
  { cat: "beauty", name: "Rose Water Toner", emoji: "🌹", price: 249, stock: 30, desc: "Refreshing alcohol-free toner made with natural rose water." },
  { cat: "beauty", name: "Beard Grooming Kit", emoji: "🧔", price: 699, was: 999, stock: 18, desc: "Beard oil, balm, comb and scissors in a gift box." },
  { cat: "beauty", name: "Floral Perfume 50ml", emoji: "🌸", price: 1199, was: 1799, stock: 22, feat: true, desc: "Long-lasting floral fragrance with a soft musk base." },
  // Books & Stationery
  { cat: "books-stationery", name: "Ruled Notebooks (Pack of 5)", emoji: "📓", price: 250, stock: 80, desc: "A5 ruled notebooks with 160 pages each." },
  { cat: "books-stationery", name: "Gel Pen Set (10)", emoji: "🖊️", price: 149, stock: 100, desc: "Smooth-writing gel pens in assorted colours." },
  { cat: "books-stationery", name: "Self-Help Bestseller Paperback", emoji: "📘", price: 399, was: 599, stock: 26, desc: "A popular paperback on building better habits." },
  { cat: "books-stationery", name: "Scientific Calculator", emoji: "🧮", price: 899, was: 1199, stock: 25, feat: true, desc: "240-function calculator approved for school and college exams." },
  { cat: "books-stationery", name: "A4 Sketch Pad", emoji: "🎨", price: 180, stock: 45, desc: "40 sheets of thick, acid-free drawing paper." },
  { cat: "books-stationery", name: "Desk Organiser", emoji: "🗂️", price: 449, was: 699, stock: 20, desc: "Multi-compartment organiser for pens, notes and a phone." },
  { cat: "books-stationery", name: "Colour Pencil Set (48)", emoji: "✏️", price: 329, was: 449, stock: 60, desc: "Vibrant, smooth colour pencils in a tin case." },
  { cat: "books-stationery", name: "School Backpack", emoji: "🎒", price: 899, was: 1399, stock: 28, desc: "Water-resistant backpack with a padded laptop sleeve." },
];

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed in production");

  const catNames = ["Grocery", "Fashion", "Electronics", "Home & Kitchen", "Beauty", "Books & Stationery"];
  for (const name of catNames) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    await prisma.category.upsert({ where: { slug }, update: {}, create: { name, slug } });
  }

  // DEV-ONLY first admin. Remove SEED_ADMIN_* from env and delete this block before deployment.
  const email = process.env.SEED_ADMIN_EMAIL, pw = process.env.SEED_ADMIN_PASSWORD;
  if (email && pw) {
    await prisma.user.upsert({
      where: { email }, update: { emailVerifiedAt: new Date() },
      create: { name: "Locora Admin", email, passwordHash: await bcrypt.hash(pw, 12), role: "ADMIN", emailVerifiedAt: new Date() },
    });
  }

  // Sample seller + store + products. Flagged isSample=true: NOT real local listings.
  const seller = await prisma.user.upsert({
    where: { email: "sample-seller@locora.local" }, update: { emailVerifiedAt: new Date() },
    create: { name: "Sample Seller", email: "sample-seller@locora.local", role: "SELLER", passwordHash: await bcrypt.hash("SampleSeller123!", 12), emailVerifiedAt: new Date() },
  });
  let store = await prisma.store.findFirst({ where: { ownerId: seller.id } });
  if (!store) store = await prisma.store.create({ data: {
    ownerId: seller.id, name: "Locora Demo Store", contactPhone: "0000000000",
    address: "Placeholder address", serviceArea: "Ludhiana", description: "Demo data for development only.",
  }});
  else if (store.name === "Sample Store (placeholder)") store = await prisma.store.update({ where: { id: store.id }, data: { name: "Locora Demo Store" } });
  // ---- Demo catalogue: 8 products per category. Safe to re-run: existing products are updated, never duplicated. ----
  const cats = await prisma.category.findMany();
  const catId = Object.fromEntries(cats.map((c) => [c.slug, c.id]));
  for (const p of CATALOG) {
    const data = {
      categoryId: catId[p.cat], description: p.desc, pricePaise: p.price * 100,
      originalPricePaise: p.was ? p.was * 100 : null, isSample: true, isFeatured: !!p.feat, isActive: true,
    };
    // `alias` = the name used by the older 3-product seed, so those rows are renamed instead of duplicated.
    let existing = await prisma.product.findFirst({ where: { storeId: store.id, name: p.name } });
    if (!existing && p.alias) existing = await prisma.product.findFirst({ where: { storeId: store.id, name: p.alias } });
    const product = existing
      ? await prisma.product.update({ where: { id: existing.id }, data: { ...data, name: p.name } }) // stock is left untouched
      : await prisma.product.create({ data: { ...data, storeId: store.id, name: p.name, stock: p.stock } });
    const hasImage = await prisma.productImage.count({ where: { productId: product.id } });
    if (!hasImage) await prisma.productImage.create({ data: { productId: product.id, url: artwork(p.emoji, p.cat), isPrimary: true, sortOrder: 0 } });
  }
  console.log(`Catalogue ready: ${CATALOG.length} demo products.`);
  console.log("Seed complete.");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
