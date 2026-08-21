-- CreateTable
CREATE TABLE "TripAllowanceRate" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "dailyRate" INTEGER NOT NULL,
    "mealRate" INTEGER NOT NULL,
    "lodgingCapPerNight" INTEGER NOT NULL,

    CONSTRAINT "TripAllowanceRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TripAllowanceRate_year_key" ON "TripAllowanceRate"("year");

-- Backfill: 기존 CompanySettings.dailyAllowanceRate/mealAllowanceRate를 올해 기준연도 행으로 이관
-- (숙박비 상한액은 기존에 없던 개념이므로 넉넉한 기본값 100000원/박으로 시작한다 — 관리자가 회사 기본정보에서 조정 가능).
INSERT INTO "TripAllowanceRate" ("id", "year", "dailyRate", "mealRate", "lodgingCapPerNight")
SELECT 'tar-' || EXTRACT(YEAR FROM now())::text, EXTRACT(YEAR FROM now())::int, "dailyAllowanceRate", "mealAllowanceRate", 100000
FROM "CompanySettings"
LIMIT 1
ON CONFLICT ("year") DO NOTHING;

-- AlterTable
ALTER TABLE "CompanySettings" DROP COLUMN "dailyAllowanceRate",
DROP COLUMN "mealAllowanceRate";

-- AlterTable
ALTER TABLE "Department" DROP COLUMN "leaveBasis";
