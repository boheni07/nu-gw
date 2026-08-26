-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "allowedCheckInIpRanges" TEXT NOT NULL DEFAULT '10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.1/32';

-- RenameIndex
ALTER INDEX "User_email_key" RENAME TO "User_username_key";
