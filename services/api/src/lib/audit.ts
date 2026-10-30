import { Prisma } from "@prisma/client";
import { prisma } from "../db";
type Db = Prisma.TransactionClient | typeof prisma;
export const audit = (db: Db, actorId: string, action: string, targetType: string, targetId: string) =>
  db.auditLog.create({ data: { actorId, action, targetType, targetId } });
