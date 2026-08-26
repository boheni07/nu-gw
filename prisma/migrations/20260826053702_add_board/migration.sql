-- CreateTable
CREATE TABLE "BoardPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isNotice" BOOLEAN NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "editedAt" TEXT,

    CONSTRAINT "BoardPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardAttachment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedAt" TEXT NOT NULL,

    CONSTRAINT "BoardAttachment_pkey" PRIMARY KEY ("id")
);
