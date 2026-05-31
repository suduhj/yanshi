-- CreateTable
CREATE TABLE "TaskEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT,
    "taskTitle" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" TEXT,
    "chinaDateKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TaskEvent_taskId_createdAt_idx" ON "TaskEvent"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskEvent_chinaDateKey_createdAt_idx" ON "TaskEvent"("chinaDateKey", "createdAt");
