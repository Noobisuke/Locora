import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";

export const addressRouter = Router();
addressRouter.use(requireAuth);

const addressSchema = z.object({
  label: z.string().trim().min(1).max(30),
  line1: z.string().trim().min(3).max(150),
  line2: z.string().trim().max(150).optional(),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit Indian pincode"),
  phone: z.string().regex(/^[0-9+\-\s]{7,15}$/),
  isDefault: z.boolean().default(false),
});

addressRouter.get("/", async (req, res) => {
  const addresses = await prisma.address.findMany({ where: { userId: req.user!.id }, orderBy: { id: "desc" } });
  res.json({ addresses });
});

addressRouter.post("/", async (req, res) => {
  const p = addressSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input", details: p.error.flatten().fieldErrors });
  const userId = req.user!.id;
  const address = await prisma.$transaction(async (tx) => {
    const first = (await tx.address.count({ where: { userId } })) === 0;
    const makeDefault = p.data.isDefault || first;
    if (makeDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return tx.address.create({ data: { ...p.data, isDefault: makeDefault, userId } });
  });
  res.status(201).json({ address });
});

// Ownership check: updateMany/deleteMany with userId in the filter means other users' rows are never touched.
addressRouter.put("/:id", async (req, res) => {
  const p = addressSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input", details: p.error.flatten().fieldErrors });
  const userId = req.user!.id;
  const result = await prisma.$transaction(async (tx) => {
    if (p.data.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return tx.address.updateMany({ where: { id: req.params.id, userId }, data: p.data });
  });
  if (result.count === 0) return res.status(404).json({ error: "Address not found" });
  res.json({ address: await prisma.address.findUnique({ where: { id: req.params.id } }) });
});

addressRouter.delete("/:id", async (req, res) => {
  const inUse = await prisma.order.count({ where: { addressId: req.params.id, userId: req.user!.id } });
  if (inUse > 0) return res.status(409).json({ error: "Address is used by an existing order and cannot be deleted" });
  const r = await prisma.address.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
  if (r.count === 0) return res.status(404).json({ error: "Address not found" });
  res.status(204).end();
});
