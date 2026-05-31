import { z } from "zod";

import { createDeepSeekCompletion, type DeepSeekCompletionResult } from "../ai/deepseek";
import {
  TASK_TYPES,
  createTaskInputSchema,
  getChinaDateKey,
  toChinaDateTimeInput,
  type TaskType,
} from "./domain";
import type { TaskFormValues } from "./form-state";

type CompleteTaskDraft = typeof createDeepSeekCompletion;

type ParseTaskDraftOptions = {
  complete?: CompleteTaskDraft;
  now?: Date;
};

type TaskDraftResult =
  | {
      aiInput: string;
      aiMessage: string;
      ok: true;
      values: TaskFormValues;
    }
  | {
      aiInput: string;
      aiMessage: string;
      ok: false;
      values: TaskFormValues;
    };

const taskDraftSchema = z.object({
  dueAt: z.string().optional().default(""),
  isDaily: z.boolean().optional().default(false),
  isLongRunning: z.boolean().optional().default(false),
  isPlannedToday: z.boolean().optional().default(false),
  nextAction: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  source: z.string().optional().default(""),
  title: z.string().optional().default(""),
  type: z.string().optional().default("life"),
});

export async function parseTaskDraftFromText(
  aiInput: string,
  options: ParseTaskDraftOptions = {},
): Promise<TaskDraftResult> {
  if (!aiInput.trim()) {
    return {
      aiInput,
      aiMessage: "请先输入要解析的任务描述。",
      ok: false,
      values: {},
    };
  }

  const complete = options.complete ?? createDeepSeekCompletion;
  const completion = await complete({
    messages: buildTaskDraftMessages(aiInput, options.now ?? new Date()),
  });

  if (!completion.ok) {
    return failure(aiInput, completion.reason);
  }

  const parsedJson = parseJson(completion);
  if (!parsedJson.ok) {
    return failure(aiInput, parsedJson.reason);
  }

  const draft = taskDraftSchema.safeParse(parsedJson.value);
  if (!draft.success) {
    return failure(aiInput, "DeepSeek 返回的任务草稿字段不完整，请重试。");
  }

  const values = toTaskFormValues(draft.data);
  const parsedTask = createTaskInputSchema.safeParse(values);
  if (!parsedTask.success) {
    return failure(aiInput, "DeepSeek 返回的任务草稿未通过校验，请重试。");
  }

  return {
    aiInput,
    aiMessage: "已解析为任务草稿，请检查后添加。",
    ok: true,
    values: {
      ...values,
      dueAt: toChinaDateTimeInput(parsedTask.data.dueAt),
    },
  };
}

function buildTaskDraftMessages(aiInput: string, now: Date) {
  const today = getChinaDateKey(now);

  return [
    {
      content:
        "你是砚时任务解析助手。请把用户的一段中文自然语言解析为单个任务草稿，只返回 JSON，不要返回 Markdown 或解释。",
      role: "system" as const,
    },
    {
      content: [
        `当前中国日期是 ${today}。`,
        "JSON 字段必须是：title, type, source, dueAt, isLongRunning, isPlannedToday, isDaily, nextAction, notes。",
        `type 只能从这些值中选择：${TASK_TYPES.join(", ")}。无法判断时使用 life。`,
        "dueAt 使用 datetime-local 格式 YYYY-MM-DDTHH:mm，按中国时间理解；无法判断截止时间时返回空字符串。",
        "布尔字段必须返回 true 或 false。不要直接创建任务，只生成草稿。",
        `用户描述：${aiInput}`,
      ].join("\n"),
      role: "user" as const,
    },
  ];
}

function parseJson(completion: Extract<DeepSeekCompletionResult, { ok: true }>) {
  try {
    return {
      ok: true as const,
      value: JSON.parse(completion.content) as unknown,
    };
  } catch {
    return {
      ok: false as const,
      reason: "DeepSeek 返回的任务草稿不是有效 JSON，请重试。",
    };
  }
}

function toTaskFormValues(draft: z.infer<typeof taskDraftSchema>): TaskFormValues {
  return {
    dueAt: draft.dueAt,
    isDaily: draft.isDaily ? "on" : "",
    isLongRunning: draft.isLongRunning ? "on" : "",
    isPlannedToday: draft.isPlannedToday ? "on" : "",
    nextAction: draft.nextAction,
    notes: draft.notes,
    source: draft.source,
    title: draft.title,
    type: normalizeTaskType(draft.type),
  };
}

function normalizeTaskType(type: string): TaskType {
  return TASK_TYPES.includes(type as TaskType) ? (type as TaskType) : "life";
}

function failure(aiInput: string, aiMessage: string): TaskDraftResult {
  return {
    aiInput,
    aiMessage,
    ok: false,
    values: {},
  };
}
