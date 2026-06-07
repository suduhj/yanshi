import { TASK_TYPE_LABELS, getChinaDateKey } from "./domain";

const DAY_MS = 86_400_000;
const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;

export type StatsTask = {
  id: string;
  source: string | null;
  type: string;
};

export type StatsEvent = {
  chinaDateKey: string;
  createdAt: Date;
  id: string;
  summary: string;
  taskTitle: string;
  type: string;
};

export function buildDateWindow(now = new Date(), days = 7) {
  const todayStart = getChinaDayStartUtcMs(now);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(todayStart - (days - 1 - index) * DAY_MS);
    return getChinaDateKey(date);
  });
}

export function buildStatsDashboardData(tasks: StatsTask[], events: StatsEvent[], now = new Date()) {
  const dateWindow = buildDateWindow(now, 7);
  const dateSet = new Set(dateWindow);
  const windowEvents = events.filter((event) => dateSet.has(event.chinaDateKey));
  const todayKey = getChinaDateKey(now);
  const overview = {
    completed: windowEvents.filter(isCompletedEvent).length,
    nextActionUpdated: windowEvents.filter((event) => event.type === "next_action_updated").length,
    progress: windowEvents.filter((event) => event.type === "progress_completed").length,
    rescheduled: windowEvents.filter(isRescheduledEvent).length,
    todayRecords: windowEvents.filter((event) => event.chinaDateKey === todayKey).length,
  };
  const trend = dateWindow.map((chinaDateKey) => {
    const dayEvents = windowEvents.filter((event) => event.chinaDateKey === chinaDateKey);

    return {
      chinaDateKey,
      completed: dayEvents.filter(isCompletedEvent).length,
      progress: dayEvents.filter((event) => event.type === "progress_completed").length,
      rescheduled: dayEvents.filter(isRescheduledEvent).length,
    };
  });

  return {
    overview,
    recentEvents: [...events]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10),
    sourceDistribution: buildSourceDistribution(tasks),
    trend,
    typeDistribution: buildTypeDistribution(tasks),
  };
}

export function buildTypeDistribution(tasks: StatsTask[]) {
  const counts = new Map<string, number>();

  for (const task of tasks) {
    counts.set(task.type, (counts.get(task.type) ?? 0) + 1);
  }

  return toDistribution(
    [...counts.entries()].map(([type, count]) => ({
      count,
      label: TASK_TYPE_LABELS[type as keyof typeof TASK_TYPE_LABELS] ?? type,
      type,
    })),
  );
}

export function buildSourceDistribution(tasks: StatsTask[]) {
  const counts = new Map<string, number>();

  for (const task of tasks) {
    const label = task.source?.trim() || "未填写来源";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const items = toDistribution([...counts.entries()].map(([label, count]) => ({ count, label })));

  if (items.length <= 8) {
    return items;
  }

  const visible = items.slice(0, 8);
  const otherCount = items.slice(8).reduce((sum, item) => sum + item.count, 0);
  const max = Math.max(...visible.map((item) => item.count), otherCount);

  return [
    ...visible.map((item) => ({ ...item, ratio: max === 0 ? 0 : item.count / max })),
    { count: otherCount, label: "其他来源", ratio: max === 0 ? 0 : otherCount / max },
  ];
}

function toDistribution<T extends { count: number }>(items: T[]) {
  const sorted = [...items].sort((a, b) => b.count - a.count);
  const max = sorted[0]?.count ?? 0;

  return sorted.map((item) => ({
    ...item,
    ratio: max === 0 ? 0 : item.count / max,
  }));
}

function isCompletedEvent(event: Pick<StatsEvent, "type">) {
  return (
    event.type === "task_completed" ||
    event.type === "daily_completed" ||
    event.type === "morning_confirmed_done"
  );
}

function isRescheduledEvent(event: Pick<StatsEvent, "type">) {
  return event.type === "due_postponed" || event.type === "marked_unfinished_today";
}

function getChinaDayStartUtcMs(date: Date) {
  const chinaDate = new Date(date.getTime() + CHINA_OFFSET_MS);

  return Date.UTC(
    chinaDate.getUTCFullYear(),
    chinaDate.getUTCMonth(),
    chinaDate.getUTCDate(),
  ) - CHINA_OFFSET_MS;
}
