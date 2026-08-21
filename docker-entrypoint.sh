#!/bin/sh
# Design Ref: module-14 PostgreSQL 전환 — 컨테이너 기동 시 대기중인 마이그레이션을 적용한 뒤 서버를 시작한다.
set -e

echo "[entrypoint] applying database migrations..."
node node_modules/prisma/build/index.js migrate deploy

echo "[entrypoint] starting server..."
exec node server.js
