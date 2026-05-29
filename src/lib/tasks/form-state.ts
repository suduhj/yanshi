import type { CreateTaskInput, UpdateTaskInput } from "./domain";
import { createTaskInputSchema, updateTaskInputSchema } from "./domain";

export type TaskFormValues = Record<string, string>;

export type TaskFormState = {
  errors: Record<string, string[]>;
  message: string;
  status: "idle" | "error";
  values: TaskFormValues;
};

export type ParsedTaskForm<T> =
  | {
      input: T;
      ok: true;
    }
  | {
      ok: false;
      state: TaskFormState;
    };

export const initialTaskFormState: TaskFormState = {
  errors: {},
  message: "",
  status: "idle",
  values: {},
};

export function parseCreateTaskForm(formData: FormData): ParsedTaskForm<CreateTaskInput> {
  return parseTaskForm(formData, createTaskInputSchema);
}

export function parseUpdateTaskForm(formData: FormData): ParsedTaskForm<UpdateTaskInput> {
  return parseTaskForm(formData, updateTaskInputSchema);
}

function parseTaskForm<T>(formData: FormData, schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { flatten: () => { fieldErrors: Record<string, string[]> } } } }): ParsedTaskForm<T> {
  const values = formDataToValues(formData);
  const dateError = getDateTimeError(values.dueAt);
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));

  if (parsed.success && !dateError) {
    return {
      input: parsed.data,
      ok: true,
    };
  }

  const errors = parsed.success ? {} : parsed.error.flatten().fieldErrors;

  if (dateError) {
    errors.dueAt = [dateError];
  }

  return {
    ok: false,
    state: {
      errors,
      message: "请检查任务信息",
      status: "error",
      values,
    },
  };
}

function formDataToValues(formData: FormData): TaskFormValues {
  const values: TaskFormValues = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      values[key] = value;
    }
  }

  return values;
}

function getDateTimeError(value: string | undefined) {
  if (!value) {
    return "";
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return "截止时间格式不正确";
  }

  return "";
}
