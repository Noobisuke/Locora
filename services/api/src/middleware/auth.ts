import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { config } from "../config";
import { prisma } from "../db";

export interface AuthUser { id: string; role: Role }
declare global { namespace Express { interface Request { user?: AuthUser } } }

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Authentication required" });
  try {
    const payload = jwt.verify(header.slice(7), config.JWT_SECRET) as { sub: string };
    // Re-read the user so role changes / deactivation apply immediately.
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) return res.status(401).json({ error: "Invalid session" });
    if (!user.emailVerifiedAt) return res.status(403).json({ error: "Please verify your email first", code: "EMAIL_NOT_VERIFIED" });
    req.user = { id: user.id, role: user.role };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export const requireRole = (...roles: Role[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
  next();
};
