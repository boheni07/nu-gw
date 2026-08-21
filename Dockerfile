# nuGW 업무관리 플랫폼 — 프로덕션 Docker 이미지
# module-14: Postgres(Prisma) 기반. 앱 컨테이너 기동 시 docker-entrypoint.sh가 마이그레이션을 적용한다.
# 업로드 파일(uploads/)은 볼륨으로 마운트해 컨테이너 재시작에도 보존한다.

FROM node:20-alpine AS deps
WORKDIR /app
# Prisma 쿼리 엔진이 Alpine(musl)에서 openssl을 필요로 한다.
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
# postinstall(prisma generate)이 스키마를 찾을 수 있도록 prisma/ 폴더를 npm ci 전에 미리 복사한다.
COPY prisma ./prisma
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# non-root 사용자로 실행
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# standalone 산출물만 복사(node_modules 전체 불필요 — 이미지 경량화)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# 마이그레이션 적용에 필요한 prisma CLI + 스키마 + 생성된 클라이언트(엔진 바이너리 포함)를 별도로 복사한다
# (standalone output tracing은 런타임에 실제로 import되지 않는 prisma CLI 패키지까지는 포함하지 않는다).
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p /app/uploads/leave /app/uploads/trip-report && chown -R nextjs:nodejs /app
RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
