import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  completeLongRunningProgressToday,
  completeTask,
  postponeTaskDueAt,
  updateTaskNextAction,
} from "./service";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      update: vi.fn(),
    },
  },
}));

const { prisma } = await import("@/lib/prisma");

describe("task service actions", () => {
  beforeEach(() => {
    vi.mocked(prisma.task.update).mockReset();
  });

  it("marks an ordinary task done", async () => {
    await completeTask("task-1");

    expect(prisma.task.update).toHaveBeenCalledWith({
      data: { status: "done" },
      where: { id: "task-1" },
    });
  });

  it("postpones a task due date", async () => {
    const dueAt = new Date("2026-05-31T12:00:00.000Z");

    await postponeTaskDueAt("task-1", dueAt);

    expect(prisma.task.update).toHaveBeenCalledWith({
      data: { dueAt, isPlannedToday: false },
      where: { id: "task-1" },
    });
  });

  it("updates a task next action", async () => {
    await updateTaskNextAction("task-1", "  整理材料  ");

    expect(prisma.task.update).toHaveBeenCalledWith({
      data: { nextAction: "整理材料" },
      where: { id: "task-1" },
    });
  });

  it("keeps a long-running task active when today's progress is completed", async () => {
    await completeLongRunningProgressToday("task-1");

    expect(prisma.task.update).toHaveBeenCalledWith({
      data: { isPlannedToday: false, status: "doing" },
      where: { id: "task-1" },
    });
  });
});
