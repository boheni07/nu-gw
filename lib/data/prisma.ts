// Design Ref: lib/data/store.ts — Postgres(Prisma) 클라이언트 싱글턴.
// Next.js 개발 모드 HMR에서 매 요청마다 새 PrismaClient가 생성되는 것을 막기 위해 globalThis에 캐시한다.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
