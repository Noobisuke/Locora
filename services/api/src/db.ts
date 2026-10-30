import { PrismaClient } from "@prisma/client";
// Default interactive-transaction timeout is 5s. A remote database (e.g. Neon in another region) needs more.
export const prisma = new PrismaClient({ transactionOptions: { maxWait: 10_000, timeout: 30_000 } });
