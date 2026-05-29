-- Repair tasks saved before China-time parsing was fixed.
-- Legacy datetime-local values were treated as UTC, so China display added 8 hours.
UPDATE "Task"
SET "dueAt" = datetime("dueAt", '-8 hours')
WHERE "dueAt" IS NOT NULL;
