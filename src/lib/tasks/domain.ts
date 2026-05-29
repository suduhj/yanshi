import { z } from "zod";

export const CHINA_TIME_ZONE = "Asia/Shanghai";
const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;

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

export const SYSTEM_PRIORITIES = [
  "urgent",
  "high",
  "mediumHigh",
  "medium",
  "low",
  "lowest",
] as const;

export const SYSTEM_PRIORITY_LABELS: Record<SystemPriority, string> = {
  urgent: "最高优先级",
  high: "高优先级",
  mediumHigh: "中高优先级",
  medium: "中优先级",
  low: "低优先级",
  lowest: "最低优先级",
};

export const TASK_STATUSES = ["todo", "doing", "done"] as const;

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "待办",
  doing: "进行中",
  done: "已完成",
};

export const DUE_FILTERS = ["all", "overdue", "today", "upcoming", "none"] as const;

export const DUE_FILTER_LABELS: Record<DueFilter, string> = {
  all: "全部截止",
  overdue: "已逾期",
  today: "今天",
  upcoming: "未来",
  none: "无截止",
};

export type TaskType = (typeof TASK_TYPES)[number];
export type SystemPriority = (typeof SYSTEM_PRIORITIES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type DueFilter = (typeof DUE_FILTERS)[number];

export type TaskFilters = {
  due?: DueFilter;
  status?: TaskStatus | "all";
  type?: TaskType | "all";
};

export type TaskLike = {
  createdAt?: Date;
  dueAt: Date | null;
  id?: string;
  isLongRunning?: boolean;
  nextAction?: string;
  notes?: string;
  source?: string;
  status: TaskStatus;
  title?: string;
  type: TaskType;
  updatedAt?: Date;
};

const baseTaskInputSchema = z.object({
  title: z.string().trim().min(1, "请填写任务标题").max(120, "标题不要超过 120 个字"),
  type: z.enum(TASK_TYPES),
  source: z.string().trim().max(80, "来源不要超过 80 个字").optional().default(""),
  dueAt: z.preprocess(parseChinaDateTimeInput, z.date().nullable()),
  notes: z.string().trim().max(1000, "备注不要超过 1000 个字").optional().default(""),
  isLongRunning: z.preprocess(parseCheckboxInput, z.boolean()).default(false),
  nextAction: z.string().trim().max(240, "下一步动作不要超过 240 个字").optional().default(""),
});

export const createTaskInputSchema = baseTaskInputSchema;

export const updateTaskInputSchema = baseTaskInputSchema.extend({
  status: z.enum(TASK_STATUSES),
});

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;

export function toTaskStatus(value: FormDataEntryValue | string | null): TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus) ? (value as TaskStatus) : "todo";
}

export function toTaskFilters(searchParams: {
  due?: string | string[];
  status?: string | string[];
  type?: string | string[];
}): TaskFilters {
  return {
    status: pickAllowed(searchParams.status, TASK_STATUSES, "all"),
    type: pickAllowed(searchParams.type, TASK_TYPES, "all"),
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

      if (task.isLongRunning) {
        summary.longRunning += 1;
      }

      const bucket = getDueBucket(task.dueAt, now);
      if (bucket === "overdue") {
        summary.overdue += 1;
      }
      if (bucket === "today") {
        summary.today += 1;
      }

      return summary;
    },
    { total: 0, overdue: 0, today: 0, longRunning: 0, done: 0 },
  );
}

export function buildTaskSections<T extends TaskLike>(tasks: T[], now = new Date()) {
  const sorted = [...tasks].sort((a, b) => compareTasks(a, b, now));

  return {
    todayMustDo: sorted.filter((task) => {
      const bucket = getDueBucket(task.dueAt, now);
      return task.status !== "done" && !task.isLongRunning && (bucket === "overdue" || bucket === "today");
    }),
    longRunning: sorted.filter((task) => task.status !== "done" && task.isLongRunning),
    other: sorted.filter((task) => {
      const bucket = getDueBucket(task.dueAt, now);
      return task.status !== "done" && !task.isLongRunning && bucket !== "overdue" && bucket !== "today";
    }),
    done: sorted.filter((task) => task.status === "done"),
  };
}

export function compareTasks(a: TaskLike, b: TaskLike, now = new Date()) {
  const priorityDiff = priorityRank(getSystemPriority(a, now).value) - priorityRank(getSystemPriority(b, now).value);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const aTime = a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const bTime = b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  if (aTime !== bTime) {
    return aTime - bTime;
  }

  return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
}

export function getSystemPriority(task: Pick<TaskLike, "dueAt"> & { status?: TaskStatus }, now = new Date()) {
  if (task.status === "done") {
    return { value: "lowest" as const, label: SYSTEM_PRIORITY_LABELS.lowest };
  }

  if (!task.dueAt) {
    return { value: "low" as const, label: SYSTEM_PRIORITY_LABELS.low };
  }

  const days = diffChinaDays(task.dueAt, now);

  if (days <= 0) {
    return { value: "urgent" as const, label: SYSTEM_PRIORITY_LABELS.urgent };
  }
  if (days === 1) {
    return { value: "high" as const, label: SYSTEM_PRIORITY_LABELS.high };
  }
  if (days <= 3) {
    return { value: "mediumHigh" as const, label: SYSTEM_PRIORITY_LABELS.mediumHigh };
  }
  if (days <= 7) {
    return { value: "medium" as const, label: SYSTEM_PRIORITY_LABELS.medium };
  }

  return { value: "low" as const, label: SYSTEM_PRIORITY_LABELS.low };
}

export function formatChinaDateTime(date: Date | null) {
  if (!date) {
    return "无截止时间";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: CHINA_TIME_ZONE,
  }).format(date);
}

export function toChinaDateTimeInput(date: Date | null) {
  if (!date) {
    return "";
  }

  const chinaDate = new Date(date.getTime() + CHINA_OFFSET_MS);
  return chinaDate.toISOString().slice(0, 16);
}

function parseChinaDateTimeInput(value: unknown) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const [, year, month, day, hour, minute] = match;
  return new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)) -
      CHINA_OFFSET_MS,
  );
}

function parseCheckboxInput(value: unknown) {
  return value === "on" || value === "true" || value === true;
}

function getDueBucket(dueAt: Date | null, now: Date): DueFilter {
  if (!dueAt) {
    return "none";
  }

  const days = diffChinaDays(dueAt, now);
  if (days < 0) {
    return "overdue";
  }
  if (days === 0) {
    return "today";
  }

  return "upcoming";
}

function diffChinaDays(target: Date, now: Date) {
  const targetStart = getChinaDayStartUtcMs(target);
  const nowStart = getChinaDayStartUtcMs(now);
  return Math.round((targetStart - nowStart) / 86_400_000);
}

function getChinaDayStartUtcMs(date: Date) {
  const chinaDate = new Date(date.getTime() + CHINA_OFFSET_MS);
  return Date.UTC(
    chinaDate.getUTCFullYear(),
    chinaDate.getUTCMonth(),
    chinaDate.getUTCDate(),
  ) - CHINA_OFFSET_MS;
}

function priorityRank(priority: SystemPriority) {
  return SYSTEM_PRIORITIES.indexOf(priority);
}

function pickAllowed<const T extends readonly string[]>(
  value: string | string[] | undefined,
  allowed: T,
  fallback: T[number] | "all",
) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return allowed.includes(candidate ?? "") ? (candidate as T[number]) : fallback;
}
