import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

vi.mock("./events", () => ({
  createTaskEvent: vi.fn(),
}));

vi.mock("../prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (callback) => callback({})),
  },
}));

vi.mock("./service", () => ({
  completeDailyTaskToday: vi.fn(),
  completeLongRunningProgressToday: vi.fn(),
  completeTask: vi.fn(),
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  postponeTaskDueAt: vi.fn(),
  setTaskPlannedToday: vi.fn(),
  updateTask: vi.fn(),
  updateTaskNextAction: vi.fn(),
}));

const actions = await import("./actions");
const events = await import("./events");
const { prisma } = await import("../prisma");
const service = await import("./service");

function formData(entries: Record<string, string>) {
  const data = new FormData();

  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }

  return data;
}

describe("task actions event recording", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records an event when completing an ordinary task", async () => {
    vi.mocked(service.completeTask).mockResolvedValue(makeTask({ title: "复习高数" }));

    await expect(actions.completeTaskAction(formData({ id: "task-1" }))).rejects.toThrow("redirect:/?notice=completed");

    expect(events.createTaskEvent).toHaveBeenCalledWith({
      summary: "完成任务：复习高数",
      taskId: "task-1",
      taskTitle: "复习高数",
      type: "task_completed",
    }, {});
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("records a morning confirmation event when completing from morning review", async () => {
    vi.mocked(service.completeTask).mockResolvedValue(makeTask({ title: "补交材料" }));

    await expect(actions.completeTaskAction(formData({ eventType: "morning_confirmed_done", id: "task-1" }))).rejects.toThrow("redirect:/?notice=completed");

    expect(events.createTaskEvent).toHaveBeenCalledWith({
      summary: "晨间确认完成：补交材料",
      taskId: "task-1",
      taskTitle: "补交材料",
      type: "morning_confirmed_done",
    }, {});
  });

  it("records an event when completing a daily task today", async () => {
    vi.mocked(service.completeDailyTaskToday).mockResolvedValue(makeTask({ title: "背单词" }));

    await expect(actions.completeDailyTodayAction(formData({ id: "task-1" }))).rejects.toThrow("redirect:/?notice=dailyCompleted");

    expect(events.createTaskEvent).toHaveBeenCalledWith({
      summary: "完成今日：背单词",
      taskId: "task-1",
      taskTitle: "背单词",
      type: "daily_completed",
    }, {});
  });

  it("records an event when completing today's progress", async () => {
    vi.mocked(service.completeLongRunningProgressToday).mockResolvedValue(makeTask({ title: "竞赛作品" }));

    await expect(actions.completeLongRunningProgressTodayAction(formData({ id: "task-1" }))).rejects.toThrow("redirect:/?notice=progressCompleted");

    expect(events.createTaskEvent).toHaveBeenCalledWith({
      summary: "今日推进：竞赛作品",
      taskId: "task-1",
      taskTitle: "竞赛作品",
      type: "progress_completed",
    }, {});
  });

  it("records an event when updating the next action", async () => {
    vi.mocked(service.updateTaskNextAction).mockResolvedValue(makeTask({ nextAction: "整理参考图", title: "成图任务" }));

    await expect(actions.updateTaskNextActionAction(formData({ id: "task-1", nextAction: "整理参考图" }))).rejects.toThrow("redirect:/?notice=nextActionUpdated");

    expect(events.createTaskEvent).toHaveBeenCalledWith({
      metadata: { nextAction: "整理参考图" },
      summary: "更新下一步：整理参考图",
      taskId: "task-1",
      taskTitle: "成图任务",
      type: "next_action_updated",
    }, {});
  });

  it("records an event when postponing the due date", async () => {
    const dueAt = new Date("2026-05-31T12:00:00.000Z");
    vi.mocked(service.postponeTaskDueAt).mockResolvedValue(makeTask({ dueAt, title: "提交材料" }));

    await expect(actions.postponeTaskDueAtAction(formData({ dueAt: "2026-05-31T20:00", id: "task-1" }))).rejects.toThrow("redirect:/?notice=postponed");

    expect(events.createTaskEvent).toHaveBeenCalledWith({
      metadata: { dueAt: dueAt.toISOString() },
      summary: "推迟截止时间：提交材料",
      taskId: "task-1",
      taskTitle: "提交材料",
      type: "due_postponed",
    }, {});
  });

  it("records an event when marking an unfinished task for today", async () => {
    vi.mocked(service.setTaskPlannedToday).mockResolvedValue(makeTask({ title: "补交作业" }));

    await expect(actions.markUnfinishedPlannedTodayAction(formData({ id: "task-1" }))).rejects.toThrow("redirect:/?notice=plannedToday");

    expect(events.createTaskEvent).toHaveBeenCalledWith({
      summary: "未完成，加入今日：补交作业",
      taskId: "task-1",
      taskTitle: "补交作业",
      type: "marked_unfinished_today",
    }, {});
  });
});

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: new Date("2026-05-31T00:00:00.000Z"),
    dailyCompletedOn: null,
    dueAt: null,
    id: "task-1",
    isDaily: false,
    isLongRunning: false,
    isPlannedToday: false,
    nextAction: "",
    notes: "",
    priority: "medium",
    source: "",
    status: "todo",
    title: "任务",
    type: "life",
    updatedAt: new Date("2026-05-31T00:00:00.000Z"),
    ...overrides,
  };
}
