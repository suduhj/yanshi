import { describe, expect, it } from "vitest";

import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  buildTaskSummary,
  createTaskInputSchema,
  matchesTaskFilters,
  toTaskStatus,
} from "./domain";

const baseTask = {
  id: "task-1",
  title: "成图作业",
  type: TASK_TYPES[1],
  source: "建筑制图课",
  dueAt: new Date("2026-06-01T10:00:00.000Z"),
  priority: TASK_PRIORITIES[2],
  status: TASK_STATUSES[0],
  notes: "完成平面图",
  createdAt: new Date("2026-05-29T08:00:00.000Z"),
  updatedAt: new Date("2026-05-29T08:00:00.000Z"),
};

describe("task domain", () => {
  it("normalizes a create task payload from form data", () => {
    const parsed = createTaskInputSchema.parse({
      title: "  晚上完成成图  ",
      type: "drawing",
      source: "  成图老师  ",
      dueAt: "2026-06-01T18:30",
      priority: "high",
      notes: "  先画轴网  ",
    });

    expect(parsed).toEqual({
      title: "晚上完成成图",
      type: "drawing",
      source: "成图老师",
      dueAt: new Date("2026-06-01T18:30:00.000Z"),
      priority: "high",
      notes: "先画轴网",
    });
  });

  it("rejects an empty title", () => {
    const parsed = createTaskInputSchema.safeParse({
      title: " ",
      type: "coursework",
      source: "",
      dueAt: "2026-06-01T18:30",
      priority: "medium",
      notes: "",
    });

    expect(parsed.success).toBe(false);
  });

  it("guards task status transitions from arbitrary values", () => {
    expect(toTaskStatus("done")).toBe("done");
    expect(toTaskStatus("not-a-status")).toBe("todo");
  });

  it("matches tasks by status, type, priority, and due window", () => {
    expect(
      matchesTaskFilters(baseTask, {
        status: "todo",
        type: "drawing",
        priority: "high",
        due: "upcoming",
      }),
    ).toBe(true);

    expect(
      matchesTaskFilters(baseTask, {
        status: "done",
        type: "drawing",
        priority: "high",
        due: "upcoming",
      }),
    ).toBe(false);
  });

  it("summarizes overdue, today, upcoming, and done tasks", () => {
    const now = new Date("2026-05-29T12:00:00.000Z");
    const summary = buildTaskSummary([
      { ...baseTask, id: "overdue", dueAt: new Date("2026-05-28T12:00:00.000Z") },
      { ...baseTask, id: "today", dueAt: new Date("2026-05-29T15:00:00.000Z") },
      { ...baseTask, id: "upcoming", dueAt: new Date("2026-06-02T15:00:00.000Z") },
      { ...baseTask, id: "done", status: "done" },
    ], now);

    expect(summary).toEqual({
      total: 4,
      overdue: 1,
      today: 1,
      upcoming: 1,
      done: 1,
    });
  });
});
