import { describe, expect, it } from "vitest";

import { buildReminderCheck, runReminderCheck } from "./reminder";
import { TASK_TYPES, type TaskLike } from "../tasks/domain";

const now = new Date("2026-05-29T04:00:00.000Z"); // 2026-05-29 12:00 in China.

const baseTask: TaskLike = {
  dailyCompletedOn: null,
  dueAt: null,
  id: "task-1",
  isDaily: false,
  isLongRunning: false,
  isPlannedToday: false,
  nextAction: "",
  status: "todo",
  title: "整理资料",
  type: TASK_TYPES[0],
};

describe("local reminder agent", () => {
  it("builds reminders for needs-confirmation and today due tasks", () => {
    const result = buildReminderCheck([
      {
        ...baseTask,
        dueAt: new Date("2026-05-28T12:00:00.000Z"),
        id: "overdue",
        title: "补交作业",
      },
      {
        ...baseTask,
        dueAt: new Date("2026-05-29T15:00:00.000Z"),
        id: "today",
        title: "今晚复习",
      },
    ], now);

    expect(result.status).toBe("ready");
    expect(result.reminders.map((reminder) => reminder.title)).toEqual([
      "补交作业需要确认",
      "今晚复习今天截止",
    ]);
    expect(result.reminders[0]).toMatchObject({
      detail: "截止时间已经过去，请先确认是否已经完成。",
      level: "focus",
      taskId: "overdue",
    });
  });

  it("builds a reminder for daily tasks not completed today", () => {
    const result = buildReminderCheck([
      {
        ...baseTask,
        dailyCompletedOn: "2026-05-28",
        id: "daily",
        isDaily: true,
        title: "背单词",
      },
    ], now);

    expect(result.reminders).toEqual([
      {
        detail: "每日任务今天还没有记录完成。",
        id: "daily:daily",
        level: "focus",
        taskId: "daily",
        title: "背单词今日未完成",
      },
    ]);
  });

  it("builds a reminder for long-running tasks without a next action", () => {
    const result = buildReminderCheck([
      {
        ...baseTask,
        id: "long",
        isLongRunning: true,
        nextAction: "",
        title: "竞赛作品",
        type: "competition",
      },
    ], now);

    expect(result.reminders).toEqual([
      {
        detail: "持续推进任务缺少下一步动作，建议先写一个可执行的小动作。",
        id: "long-running:long",
        level: "info",
        taskId: "long",
        title: "竞赛作品需要下一步",
      },
    ]);
  });

  it("ignores completed ordinary tasks and completed daily tasks", async () => {
    const result = await runReminderCheck([
      {
        ...baseTask,
        dueAt: new Date("2026-05-28T12:00:00.000Z"),
        id: "done",
        status: "done",
        title: "已完成作业",
      },
      {
        ...baseTask,
        dailyCompletedOn: "2026-05-29",
        id: "daily-done",
        isDaily: true,
        title: "背单词",
      },
    ], now);

    expect(result).toEqual({
      checkedAt: now,
      reminders: [],
      status: "idle",
    });
  });
});
