import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    taskEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { createTaskEvent, listRecentTaskEvents, listTodayTaskEvents, summarizeTaskEventsByType } from "./events";
import { prisma } from "../prisma";

describe("task events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores a task event with a China date key", async () => {
    vi.mocked(prisma.taskEvent.create).mockResolvedValue(makeEvent({
      chinaDateKey: "2026-05-31",
      taskId: "task-1",
      taskTitle: "复习高数",
    }));

    const event = await createTaskEvent({
      now: new Date("2026-05-31T10:00:00.000Z"),
      summary: "完成任务：复习高数",
      taskId: "task-1",
      taskTitle: "复习高数",
      type: "task_completed",
    });

    expect(prisma.taskEvent.create).toHaveBeenCalledWith({
      data: {
        chinaDateKey: "2026-05-31",
        createdAt: new Date("2026-05-31T10:00:00.000Z"),
        metadata: null,
        summary: "完成任务：复习高数",
        taskId: "task-1",
        taskTitle: "复习高数",
        type: "task_completed",
      },
    });
    expect(event.chinaDateKey).toBe("2026-05-31");
    expect(event.taskTitle).toBe("复习高数");
  });

  it("groups today's events by type", async () => {
    vi.mocked(prisma.taskEvent.findMany).mockResolvedValue([
      makeEvent({
        summary: "今日推进：整理材料",
        taskTitle: "整理材料",
        type: "progress_completed",
      }),
    ]);

    const events = await listTodayTaskEvents(new Date("2026-05-31T12:00:00.000Z"));
    const summary = summarizeTaskEventsByType(events);

    expect(prisma.taskEvent.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      where: { chinaDateKey: "2026-05-31" },
    });
    expect(events).toHaveLength(1);
    expect(summary.progressCompleted).toHaveLength(1);
    expect(summary.completed).toHaveLength(0);
  });

  it("lists recent events for a task in newest-first order", async () => {
    vi.mocked(prisma.taskEvent.findMany).mockResolvedValue([
      makeEvent({ summary: "今日推进：竞赛报名" }),
      makeEvent({ summary: "更新下一步：确认队友信息" }),
    ]);

    const events = await listRecentTaskEvents("task-1");

    expect(prisma.taskEvent.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      take: 8,
      where: { taskId: "task-1" },
    });
    expect(events.map((event) => event.summary)).toEqual([
      "今日推进：竞赛报名",
      "更新下一步：确认队友信息",
    ]);
  });
});

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    chinaDateKey: "2026-05-31",
    createdAt: new Date("2026-05-31T00:00:00.000Z"),
    id: "event-1",
    metadata: null,
    summary: "今日推进：竞赛报名",
    taskId: "task-1",
    taskTitle: "竞赛报名",
    type: "progress_completed",
    ...overrides,
  };
}
