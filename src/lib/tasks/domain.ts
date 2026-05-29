import { z } from "zod";

export const TASK_TYPES = [
  "coursework",
  "drawing",
  "exam",
  "activity",
  "league",
  "life",
] as const;

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  coursework: "课程作业",
  drawing: "成图任务",
  exam: "考试复习",
  activity: "学校活动",
  league: "团支书任务",
  life: "生活杂事",
};

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

export const TASK_STATUSES = ["todo", "doing", "done"] as const;

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "待办",
  doing: "进行中",
  done: "已完成",
};

export const DUE_FILTERS = ["all", "overdue", "today", "upcoming"] as const;

export const DUE_FILTER_LABELS: Record<DueFilter, string> = {
  all: "全部截止",
  overdue: "已逾期",
  today: "今天",
  upcoming: "未来",
};

export type TaskType = (typeof TASK_TYPES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type DueFilter = (typeof DUE_FILTERS)[number];

export type TaskFilters = {
  status?: TaskStatus | "all";
  type?: TaskType | "all";
  priority?: TaskPriority | "all";
  due?: DueFilter;
};

export type TaskLike = {
  id?: string;
  dueAt: Date;
  priority: TaskPriority;
  status: TaskStatus;
  type: TaskType;
};

export const createTaskInputSchema = z.object({
  title: z.string().trim().min(1, "请填写任务标题").max(120, "标题不要超过 120 个字"),
  type: z.enum(TASK_TYPES),
  source: z.string().trim().max(80, "来源不要超过 80 个字").optional().default(""),
  dueAt: z.preprocess(parseDateTimeInput, z.date()),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  notes: z.string().trim().max(1000, "备注不要超过 1000 个字").optional().default(""),
});

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

export function toTaskStatus(value: FormDataEntryValue | string | null): TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus) ? (value as TaskStatus) : "todo";
}

export function toTaskFilters(searchParams: {
  due?: string | string[];
  priority?: string | string[];
  status?: string | string[];
  type?: string | string[];
}): TaskFilters {
  return {
    status: pickAllowed(searchParams.status, TASK_STATUSES, "all"),
    type: pickAllowed(searchParams.type, TASK_TYPES, "all"),
    priority: pickAllowed(searchParams.priority, TASK_PRIORITIES, "all"),
    due: pickAllowed(searchParams.due, DUE_FILTERS, "all"),
  };
}

export function matchesTaskFilters(task: TaskLike, filters: TaskFilters, now = new Date()) {
  if (filters.status && filters.status !== "all" && task.status !== filters.status) {
    return false;
  }

  if (filters.type && filters.type !== "all" && task.type !== filters.type) {
    return false;
  }

  if (filters.priority && filters.priority !== "all" && task.priority !== filters.priority) {
    return false;
  }

  if (!filters.due || filters.due === "all") {
    return true;
  }

  return getDueBucket(task.dueAt, now) === filters.due;
}

export function buildTaskSummary(tasks: TaskLike[], now = new Date()) {
  return tasks.reduce(
    (summary, task) => {
      summary.total += 1;

      if (task.status === "done") {
        summary.done += 1;
        return summary;
      }

      const bucket = getDueBucket(task.dueAt, now);
      if (bucket === "overdue") {
        summary.overdue += 1;
      }
      if (bucket === "today") {
        summary.today += 1;
      }
      if (bucket === "upcoming") {
        summary.upcoming += 1;
      }

      return summary;
    },
    { total: 0, overdue: 0, today: 0, upcoming: 0, done: 0 },
  );
}

function parseDateTimeInput(value: unknown) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const normalized = value.includes("T") && !value.endsWith("Z") ? `${value}:00.000Z` : value;
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function getDueBucket(dueAt: Date, now: Date): DueFilter {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  if (dueAt < start) {
    return "overdue";
  }

  if (dueAt >= start && dueAt < end) {
    return "today";
  }

  return "upcoming";
}

function pickAllowed<const T extends readonly string[]>(
  value: string | string[] | undefined,
  allowed: T,
  fallback: T[number] | "all",
) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return allowed.includes(candidate ?? "") ? (candidate as T[number]) : fallback;
}
