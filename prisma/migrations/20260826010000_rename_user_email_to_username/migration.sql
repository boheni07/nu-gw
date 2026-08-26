-- 사용자 관리 §로그인 아이디 — email 컬럼을 username으로 이름 변경(기존 데이터 보존)하고,
-- 총괄관리자 계정을 master@nubiz.kr에서 master로 변경한다.
ALTER TABLE "User" RENAME COLUMN "email" TO "username";

UPDATE "User" SET "username" = 'master' WHERE "username" = 'master@nubiz.kr';
