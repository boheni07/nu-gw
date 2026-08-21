-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "businessRegNo" TEXT NOT NULL,
    "ceoName" TEXT NOT NULL,
    "workSchedule" TEXT NOT NULL,
    "defaultLeaveBasis" TEXT NOT NULL,
    "standardWorkHoursPerDay" INTEGER NOT NULL,
    "lunchStart" TEXT NOT NULL,
    "lunchEnd" TEXT NOT NULL,
    "hourlyLeaveUnitHours" INTEGER NOT NULL,
    "hourlyLeaveMaxHours" INTEGER NOT NULL,
    "slackWebhookUrl" TEXT,
    "dailyAllowanceRate" INTEGER NOT NULL,
    "mealAllowanceRate" INTEGER NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "leaveBasis" TEXT,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "hireDate" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "employmentStatus" TEXT NOT NULL,
    "resignedAt" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalLine" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL,

    CONSTRAINT "ApprovalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalLineStep" (
    "id" TEXT NOT NULL,
    "approvalLineId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "isParallel" BOOLEAN NOT NULL,

    CONSTRAINT "ApprovalLineStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "approvalLineId" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "currentStep" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "submittedAt" TEXT NOT NULL,
    "completedAt" TEXT,
    "targetVersion" INTEGER NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalStepLog" (
    "id" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "representedUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "processedAt" TEXT NOT NULL,

    CONSTRAINT "ApprovalStepLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelegateAssignment" (
    "id" TEXT NOT NULL,
    "delegatorUserId" TEXT NOT NULL,
    "delegateUserId" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,

    CONSTRAINT "DelegateAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeavePolicy" (
    "id" TEXT NOT NULL,
    "minYears" INTEGER NOT NULL,
    "maxYears" INTEGER NOT NULL,
    "grantDays" INTEGER NOT NULL,

    CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveTypeConfig" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inputMode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "requireAttachment" BOOLEAN NOT NULL,
    "payType" TEXT NOT NULL,

    CONSTRAINT "LeaveTypeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "granted" DOUBLE PRECISION NOT NULL,
    "used" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "days" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "approvalId" TEXT,
    "version" INTEGER NOT NULL,
    "editedAt" TEXT,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedAt" TEXT NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startAt" TEXT NOT NULL,
    "endAt" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "departmentTag" TEXT,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "checkInAt" TEXT,
    "checkOutAt" TEXT,
    "status" TEXT NOT NULL,
    "autoCheckedOut" BOOLEAN NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "expectedEndTime" TEXT NOT NULL,
    "workDetail" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "approvalId" TEXT,
    "version" INTEGER NOT NULL,
    "editedAt" TEXT,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "OvertimeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessTrip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tripType" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "destination" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "transport" TEXT,
    "status" TEXT NOT NULL,
    "approvalId" TEXT,
    "version" INTEGER NOT NULL,
    "editedAt" TEXT,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "BusinessTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripReport" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workContent" TEXT NOT NULL,
    "transport" TEXT NOT NULL,
    "transportCost" INTEGER NOT NULL,
    "transportAttachment" JSONB,
    "hasLodging" BOOLEAN NOT NULL,
    "lodgingCost" INTEGER NOT NULL,
    "lodgingAttachment" JSONB,
    "dailyAllowance" INTEGER NOT NULL,
    "mealAllowance" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "approvalId" TEXT,
    "version" INTEGER NOT NULL,
    "editedAt" TEXT,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "TripReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportDate" TEXT NOT NULL,
    "todayResult" TEXT NOT NULL,
    "tomorrowPlan" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "approvalId" TEXT,
    "version" INTEGER NOT NULL,
    "editedAt" TEXT,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStartDate" TEXT NOT NULL,
    "weekEndDate" TEXT NOT NULL,
    "thisWeekResult" TEXT NOT NULL,
    "nextWeekPlan" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "approvalId" TEXT,
    "version" INTEGER NOT NULL,
    "editedAt" TEXT,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrRecord" (
    "userId" TEXT NOT NULL,
    "nameKr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "birth" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "emergencyContact" JSONB NOT NULL,
    "education" JSONB NOT NULL,
    "career" JSONB NOT NULL,
    "certificates" JSONB NOT NULL,
    "family" JSONB NOT NULL,
    "militaryStatus" TEXT NOT NULL,
    "militaryBranch" TEXT NOT NULL,
    "militaryRank" TEXT NOT NULL,
    "militaryPeriod" TEXT NOT NULL,
    "agreed" BOOLEAN NOT NULL,
    "savedAt" TEXT,

    CONSTRAINT "HrRecord_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_userId_date_key" ON "AttendanceRecord"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TripReport_tripId_key" ON "TripReport"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_userId_reportDate_key" ON "DailyReport"("userId", "reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReport_userId_weekStartDate_key" ON "WeeklyReport"("userId", "weekStartDate");

-- AddForeignKey
ALTER TABLE "ApprovalLineStep" ADD CONSTRAINT "ApprovalLineStep_approvalLineId_fkey" FOREIGN KEY ("approvalLineId") REFERENCES "ApprovalLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
