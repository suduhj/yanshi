-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "dueAt" DATETIME,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "notes" TEXT NOT NULL DEFAULT '',
    "isLongRunning" BOOLEAN NOT NULL DEFAULT false,
    "nextAction" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Task" ("createdAt", "dueAt", "id", "notes", "priority", "source", "status", "title", "type", "updatedAt") SELECT "createdAt", "dueAt", "id", "notes", "priority", "source", "status", "title", "type", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_status_idx" ON "Task"("status");
CREATE INDEX "Task_type_idx" ON "Task"("type");
CREATE INDEX "Task_priority_idx" ON "Task"("priority");
CREATE INDEX "Task_dueAt_idx" ON "Task"("dueAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
