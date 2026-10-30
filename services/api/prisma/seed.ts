import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed in production");

  const cats = ["Grocery", "Fashion", "Electronics", "Home & Kitchen", "Beauty", "Books & Stationery"];
  for (const name of cats) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    await prisma.category.upsert({ where: { slug }, update: {}, create: { name, slug } });
  }

  // DEV-ONLY first admin. Remove SEED_ADMIN_* from env and delete this block before deployment.
  const email = process.env.SEED_ADMIN_EMAIL, pw = process.env.SEED_ADMIN_PASSWORD;
  if (email && pw) {
    await prisma.user.upsert({
      where: { email }, update: {},
      create: { name: "Locora Admin", email, passwordHash: await bcrypt.hash(pw, 12), role: "ADMIN" },
    });
  }

  // Sample seller + store + products. Flagged isSample=true: NOT real local listings.
  const seller = await prisma.user.upsert({
    where: { email: "sample-seller@locora.local" }, update: {},
    create: { name: "Sample Seller", email: "sample-seller@locora.local", role: "SELLER", passwordHash: await bcrypt.hash("SampleSeller123!", 12) },
  });
  // Stores across categories
  const storesData = [
    { name: "Green Grocers & Organic Mart", phone: "9876500001", address: "Shop 12, Main Market, Model Town", area: "Model Town, Ludhiana", desc: "Fresh organic produce, pantry essentials and daily groceries." },
    { name: "Urban Vogue Apparel", phone: "9876500002", address: "SCO 45, Sarabha Nagar", area: "Sarabha Nagar, Ludhiana", desc: "Trendy casual wear, ethnic fashion, and daily wardrobe staples." },
    { name: "Apex Tech & Gadgets", phone: "9876500003", address: "Shop 8, Feroze Gandhi Market", area: "Ferozepur Road, Ludhiana", desc: "Authentic electronics, audio gear, smart accessories, and cables." },
    { name: "Nest & Haven Homeware", phone: "9876500004", address: "Plot 22, Pakhowal Road", area: "Pakhowal Road, Ludhiana", desc: "Kitchen essentials, cookware, storage and home décor." },
    { name: "Glow & Glam Botanicals", phone: "9876500005", address: "Booth 14, Mall Road", area: "Civil Lines, Ludhiana", desc: "Clean beauty, skincare, haircare, and personal hygiene products." },
    { name: "The Quill & Paper Store", phone: "9876500006", address: "Shop 3, College Road", area: "Fountain Chowk, Ludhiana", desc: "Art supplies, notebooks, pens, and desk organizers." },
  ];

  let store = await prisma.store.findFirst({ where: { ownerId: seller.id } });
  if (!store) {
    store = await prisma.store.create({
      data: {
        ownerId: seller.id,
        name: storesData[0].name,
        contactPhone: storesData[0].phone,
        address: storesData[0].address,
        serviceArea: storesData[0].area,
        description: storesData[0].desc,
      },
    });
  }

  // Pre-load all categories
  const allCats = await prisma.category.findMany();
  const catMap = new Map(allCats.map((c) => [c.slug, c.id]));

  // Delete existing sample products so we can re-seed cleanly with rich assortment
  await prisma.product.deleteMany({ where: { isSample: true } });

  const sampleProducts: {
    catSlug: string;
    name: string;
    description: string;
    pricePaise: number;
    originalPricePaise?: number;
    stock: number;
    isFeatured?: boolean;
    image: string;
  }[] = [
    // --- Grocery ---
    {
      catSlug: "grocery",
      name: "Organic Royal Basmati Rice (5kg)",
      description: "Aged long-grain aromatic basmati rice, perfect for biryanis and pulao.",
      pricePaise: 54900,
      originalPricePaise: 65000,
      stock: 40,
      isFeatured: true,
      image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80",
    },
    {
      catSlug: "grocery",
      name: "Cold-Pressed Virgin Mustard Oil (1L)",
      description: "Traditional kachi ghani pure mustard oil extracted at low temperatures.",
      pricePaise: 18500,
      originalPricePaise: 21000,
      stock: 65,
      isFeatured: true,
      image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&auto=format&fit=crop&q=80",
    },
    {
      catSlug: "grocery",
      name: "Assam CTC Premium Black Tea (500g)",
      description: "Strong malty aroma, full-bodied kadak chai blend from upper Assam gardens.",
      pricePaise: 28000,
      originalPricePaise: 32000,
      stock: 50,
      image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80",
    },
    {
      catSlug: "grocery",
      name: "Raw Forest Honey with Comb (400g)",
      description: "Unfiltered, unpasteurized natural multifloral wild forest honey.",
      pricePaise: 39900,
      originalPricePaise: 45000,
      stock: 25,
      image: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&auto=format&fit=crop&q=80",
    },
    {
      catSlug: "grocery",
      name: "California Almonds Jumbo (500g)",
      description: "Crispy, crunchy premium grade almonds packed with Vitamin E and protein.",
      pricePaise: 49900,
      originalPricePaise: 60000,
      stock: 35,
      image: "https://images.unsplash.com/photo-1508061257971-f925055b85ee?w=600&auto=format&fit=crop&q=80",
    },

    // --- Fashion ---
    {
      catSlug: "fashion",
      name: "Classic Heavyweight Cotton Crewneck Tee",
      description: "100% combed cotton, 220 GSM breathable fabric with pre-shrunk finish.",
      pricePaise: 79900,
      originalPricePaise: 129900,
      stock: 55,
      isFeatured: true,
      image: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80",
    },
    {
      catSlug: "fashion",
      name: "Handcrafted Pure Linen Casual Shirt",
      description: "Relaxed fit breathable French linen shirt, styled for summer comfort.",
      pricePaise: 189900,
      originalPricePaise: 249900,
      stock: 20,
      image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80",
    },
    {
      catSlug: "fashion",
      name: "Slim Fit Selvedge Stretch Denim",
      description: "13.5 oz Japanese selvedge denim woven with 2% elastane for daily ease.",
      pricePaise: 249900,
      originalPricePaise: 349900,
      stock: 30,
      image: "https://images.unsplash.com/photo-1542272604-780c96856592?w=600&auto=format&fit=crop&q=80",
    },
    {
      catSlug: "fashion",
      name: "Handwoven Silk Dupatta with Zari Work",
      description: "Exquisite traditional Chanderi silk with delicate golden border craftsmanship.",
      pricePaise: 145000,
      originalPricePaise: 180000,
      stock: 15,
      image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80",
    },

    // --- Electronics ---
    {
      catSlug: "electronics",
      name: "Active Noise-Cancelling Wireless Headphones",
      description: "Hybrid ANC, 40-hour battery life, 40mm dynamic drivers, ultra-soft earcups.",
      pricePaise: 399900,
      originalPricePaise: 599900,
      stock: 28,
      isFeatured: true,
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80",
    },
    {
      catSlug: "electronics",
      name: "Ultra-Fast 65W GaN Dual USB-C Charger",
      description: "Compact fast wall charger compatible with laptops, phones, and tablets.",
      pricePaise: 149900,
      originalPricePaise: 199900,
      stock: 45,
      image: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80",
    },
    {
      catSlug: "electronics",
      name: "Mechanical Gaming Keyboard RGB (Brown Switch)",
      description: "Tactile silent switches, hot-swappable PCB, braided type-C detachable cable.",
      pricePaise: 329900,
      originalPricePaise: 449900,
      stock: 18,
      image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80",
    },
    {
      catSlug: "electronics",
      name: "Rugged Waterproof Bluetooth Speaker (15W)",
      description: "IPX7 waterproof, deep punchy bass, 12-hour continuous party playtime.",
      pricePaise: 219900,
      originalPricePaise: 299900,
      stock: 32,
      image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&auto=format&fit=crop&q=80",
    },

    // --- Home & Kitchen ---
    {
      catSlug: "home-kitchen",
      name: "Pre-Seasoned Cast Iron Skillet (10.5 inch)",
      description: "Heavy-duty cast iron pan with silicone heat guard, unbeatable heat retention.",
      pricePaise: 169900,
      originalPricePaise: 220000,
      stock: 30,
      isFeatured: true,
      image: "https://images.unsplash.com/photo-1584990347449-399c565c8ea0?w=600&auto=format&fit=crop&q=80",
    },
    {
      catSlug: "home-kitchen",
      name: "Borosilicate Glass Airtight Storage Jars (Set of 4)",
      description: "Lead-free glass canisters with natural acacia wood lids and silicone sealing.",
      pricePaise: 129900,
      originalPricePaise: 169900,
      stock: 40,
      image: "https://images.unsplash.com/photo-1584589167171-541ce45f1eea?w=600&auto=format&fit=crop&q=80",
    },
    {
      catSlug: "home-kitchen",
      name: "Stainless Steel Double-Wall French Press (800ml)",
      description: "Insulated cafetiere for rich sediment-free coffee and loose leaf teas.",
      pricePaise: 189900,
      originalPricePaise: 249900,
      stock: 22,
      image: "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80",
    },
    {
      catSlug: "home-kitchen",
      name: "Pure Egyptian Cotton Bath Towel Set (2 pcs)",
      description: "600 GSM plush, ultra-absorbent Turkish weave combed luxury bath towels.",
      pricePaise: 119900,
      originalPricePaise: 159900,
      stock: 35,
      image: "https://images.unsplash.com/photo-1616627547584-bf28cee262db?w=600&auto=format&fit=crop&q=80",
    },

    // --- Beauty ---
    {
      catSlug: "beauty",
      name: "Vitamin C + Ferulic Glow Serum (30ml)",
      description: "15% active L-Ascorbic acid to brighten dull skin and fade hyperpigmentation.",
      pricePaise: 69900,
      originalPricePaise: 89900,
      stock: 50,
      isFeatured: true,
      image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&auto=format&fit=crop&q=80",
    },
    {
      catSlug: "beauty",
      name: "Cold-Pressed Moroccan Argan Hair Oil (100ml)",
      description: "Repairs dry split ends, restores shine and hydrates damaged locks naturally.",
      pricePaise: 74900,
      originalPricePaise: 95000,
      stock: 45,
      image: "https://images.unsplash.com/photo-1608248597359-58b387f3b89b?w=600&auto=format&fit=crop&q=80",
    },
    {
      catSlug: "beauty",
      name: "Ultra-Lightweight SPF 50+ Invisible Sunscreen Gel",
      description: "Zero white cast, non-sticky matte finish infused with Hyaluronic acid.",
      pricePaise: 54900,
      originalPricePaise: 69900,
      stock: 60,
      image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80",
    },
    {
      catSlug: "beauty",
      name: "Rosehip & Shea Butter Hydrating Lip Balm",
      description: "Deep nourishing lip repair butter with natural beeswax and rose extracts.",
      pricePaise: 29900,
      originalPricePaise: 39900,
      stock: 80,
      image: "https://images.unsplash.com/photo-1599305090598-fe179d501227?w=600&auto=format&fit=crop&q=80",
    },

    // --- Books & Stationery ---
    {
      catSlug: "books-stationery",
      name: "Hardcover Dotted Bullet Journal (160 GSM)",
      description: "Bleedproof bamboo paper, expandable back pocket, ribbon markers, elastic band.",
      pricePaise: 64900,
      originalPricePaise: 79900,
      stock: 45,
      isFeatured: true,
      image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80",
    },
    {
      catSlug: "books-stationery",
      name: "Precision Fine-Liner Fineliner Pens (Set of 8)",
      description: "Waterproof archival pigment ink with tip sizes from 0.05mm to brush.",
      pricePaise: 49900,
      originalPricePaise: 64900,
      stock: 50,
      image: "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=600&auto=format&fit=crop&q=80",
    },
    {
      catSlug: "books-stationery",
      name: "Handcrafted Walnut Wood Desk Organizer",
      description: "Minimalist desk tidy for pens, smartphone dock, clips, and business cards.",
      pricePaise: 129900,
      originalPricePaise: 169900,
      stock: 25,
      image: "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=600&auto=format&fit=crop&q=80",
    },
    {
      catSlug: "books-stationery",
      name: "Atomic Habits - Clear, James (Paperback)",
      description: "An easy & proven way to build good habits and break bad ones.",
      pricePaise: 45000,
      originalPricePaise: 59900,
      stock: 35,
      image: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&auto=format&fit=crop&q=80",
    },
  ];

  for (const item of sampleProducts) {
    const categoryId = catMap.get(item.catSlug);
    if (!categoryId) continue;
    const prod = await prisma.product.create({
      data: {
        storeId: store.id,
        categoryId,
        name: item.name,
        description: item.description,
        pricePaise: item.pricePaise,
        originalPricePaise: item.originalPricePaise,
        stock: item.stock,
        isFeatured: item.isFeatured ?? false,
        isSample: true,
        images: {
          create: [{ url: item.image, isPrimary: true, sortOrder: 0 }],
        },
      },
    });
  }

  console.log(`Seed complete. Added ${sampleProducts.length} curated products across all categories.`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
