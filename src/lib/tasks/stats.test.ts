import { describe, expect, it } from "vitest";

import {
  buildDateWindow,
  buildSourceDistribution,
  buildStatsDashboardData,
  buildTypeDistribution,
} from "./stats";

const now = new Date("2026-06-07T02:00:00.000Z");

const tasks = [
  makeTask({ id: "task-1", source: "高数", type: "coursework" }),
  makeTask({ id: "task-2", source: "竞赛组", type: "competition" }),
  makeTask({ id: "task-3", source: "", type: "life" }),
  makeTask({ id: "task-4", source: "高数", type: "coursework" }),
];

const events = [
  makeEvent({ chinaDateKey: "2026-06-01", type: "task_completed" }),
  makeEvent({ chinaDateKey: "2026-06-02", type: "daily_completed" }),
  makeEvent({ chinaDateKey: "2026-06-02", type: "progress_completed" }),
  makeEvent({ chinaDateKey: "2026-06-03", type: "due_postponed" }),
  makeEvent({ chinaDateKey: "2026-06-07", type: "marked_unfinished_today" }),
  makeEvent({ chinaDateKey: "2026-06-07", type: "next_action_updated" }),
];

describe("stats dashboard", () => {
  it("builds a 7-day China date window ending today", () => {
    expect(buildDateWindow(now, 7)).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
      "2026-06-06",
      "2026-06-07",
    ]);
  });

  it("groups events into overview and daily trend buckets", () => {
    const data = buildStatsDashboardData(tasks, events, now);

    expect(data.overview.completed).toBe(2);
    expect(data.overview.progress).toBe(1);
    expect(data.overview.rescheduled).toBe(2);
    expect(data.overview.todayRecords).toBe(2);
    expect(data.trend.find((day) => day.chinaDateKey === "2026-06-02")).toMatchObject({
      completed: 1,
      progress: 1,
      rescheduled: 0,
    });
  });

  it("builds type distribution with Chinese labels", () => {
    expect(buildTypeDistribution(tasks)).toEqual([
      { count: 2, label: "课程作业", ratio: 1, type: "coursework" },
      { count: 1, label: "竞赛任务", ratio: 0.5, type: "competition" },
      { count: 1, label: "生活杂事", ratio: 0.5, type: "life" },
    ]);
  });

  it("builds source distribution and groups empty source", () => {
    expect(buildSourceDistribution(tasks)).toEqual([
      { count: 2, label: "高数", ratio: 1 },
      { count: 1, label: "竞赛组", ratio: 0.5 },
      { count: 1, label: "未填写来源", ratio: 0.5 },
    ]);
  });

  it("returns stable empty dashboard data", () => {
    const data = buildStatsDashboardData([], [], now);

    expect(data.overview).toEqual({
      completed: 0,
      nextActionUpdated: 0,
      progress: 0,
      rescheduled: 0,
      todayRecords: 0,
    });
    expect(data.typeDistribution).toEqual([]);
    expect(data.sourceDistribution).toEqual([]);
    expect(data.recentEvents).toEqual([]);
    expect(data.trend).toHaveLength(7);
  });
});

function makeTask(overrides: Partial<StatsTask> = {}): StatsTask {
  return {
    id: "task",
    source: "",
    type: "life",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<StatsEvent> = {}): StatsEvent {
  return {
    chinaDateKey: "2026-06-07",
    createdAt: new Date("2026-06-07T01:00:00.000Z"),
    id: "event",
    summary: "完成任务：测试",
    taskTitle: "测试",
    type: "task_completed",
    ...overrides,
  };
}

type StatsTask = {
  id: string;
  source: string;
  type: string;
};

type StatsEvent = {
  chinaDateKey: string;
  createdAt: Date;
  id: string;
  summary: string;
  taskTitle: string;
  type: string;
};
