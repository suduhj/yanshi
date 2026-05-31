"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createTaskAction } from "@/lib/tasks/actions";
import { initialTaskFormState } from "@/lib/tasks/form-state";
import { TASK_TYPE_LABELS, TASK_TYPES } from "@/lib/tasks/domain";

export function TaskCreateForm() {
  const [state, formAction] = useActionState(createTaskAction, initialTaskFormState);
  const formKey = JSON.stringify({
    aiInput: state.aiInput,
    aiMessage: state.aiMessage,
    values: state.values,
  });

  return (
    <form action={formAction} className="mt-4 grid gap-3" key={formKey}>
      <FormMessage message={state.message} />

      <label className="grid gap-1 text-sm">
        <span className="text-neutral-600">自然语言描述</span>
        <textarea
          className="field min-h-20 resize-y"
          defaultValue={state.aiInput}
          name="aiInput"
          placeholder="例如：明天晚上八点交成图作业，加入今日计划"
        />
      </label>
      <AiMessage message={state.aiMessage} status={state.status} />
      <button
        className="h-9 border border-neutral-300 px-3 text-sm text-neutral-950 transition hover:border-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
        name="intent"
        type="submit"
        value="parseDraft"
      >
        解析填入
      </button>

      <label className="grid gap-1 text-sm">
        <span className="text-neutral-600">标题</span>
        <input
          className="field"
          defaultValue={state.values.title}
          name="title"
          placeholder="例如：周五前交成图作业"
        />
        <FieldError messages={state.errors.title} />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-neutral-600">类型</span>
        <select className="field" name="type" defaultValue={state.values.type ?? "coursework"}>
          {TASK_TYPES.map((type) => (
            <option key={type} value={type}>
              {TASK_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <FieldError messages={state.errors.type} />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-neutral-600">来源</span>
        <input
          className="field"
          defaultValue={state.values.source}
          name="source"
          placeholder="课程、老师、活动或职责来源"
        />
        <FieldError messages={state.errors.source} />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-neutral-600">截止时间</span>
        <input className="field" defaultValue={state.values.dueAt} name="dueAt" type="datetime-local" />
        <FieldError messages={state.errors.dueAt} />
      </label>

      <label className="flex items-start gap-2 border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
        <input
          className="mt-1"
          defaultChecked={state.values.isLongRunning === "on"}
          name="isLongRunning"
          type="checkbox"
        />
        <span>这是大跨度任务 / 需要持续推进</span>
      </label>

      <label className="flex items-start gap-2 border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
        <input
          className="mt-1"
          defaultChecked={state.values.isPlannedToday === "on"}
          name="isPlannedToday"
          type="checkbox"
        />
        <span>加入今日计划</span>
      </label>

      <label className="flex items-start gap-2 border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
        <input
          className="mt-1"
          defaultChecked={state.values.isDaily === "on"}
          name="isDaily"
          type="checkbox"
        />
        <span>这是每日任务</span>
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-neutral-600">下一步动作</span>
        <input
          className="field"
          defaultValue={state.values.nextAction}
          name="nextAction"
          placeholder="例如：先完成底图、整理资料、列复习提纲"
        />
        <FieldError messages={state.errors.nextAction} />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-neutral-600">备注</span>
        <textarea
          className="field min-h-24 resize-y"
          defaultValue={state.values.notes}
          name="notes"
          placeholder="补充提交要求、资料位置、注意事项"
        />
        <FieldError messages={state.errors.notes} />
      </label>

      <SubmitButton label="添加任务" pendingLabel="添加中..." />
    </form>
  );
}

function FormMessage({ message }: { message: string }) {
  if (!message) {
    return null;
  }

  return (
    <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-xs text-red-700">{messages[0]}</p>;
}

function AiMessage({ message, status }: { message?: string; status: "error" | "idle" }) {
  if (!message) {
    return null;
  }

  const className =
    status === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return <div className={`border px-3 py-2 text-sm ${className}`}>{message}</div>;
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="mt-1 h-10 border border-neutral-950 bg-neutral-950 px-4 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-500"
      disabled={pending}
      name="intent"
      type="submit"
      value="create"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
