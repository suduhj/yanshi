"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updateTaskAction } from "@/lib/tasks/actions";
import {
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  TASK_TYPE_LABELS,
  TASK_TYPES,
  type TaskStatus,
  type TaskType,
} from "@/lib/tasks/domain";
import type { TaskFormState } from "@/lib/tasks/form-state";

type EditableTask = {
  dueAtInput: string;
  isDaily: boolean;
  id: string;
  isLongRunning: boolean;
  isPlannedToday: boolean;
  nextAction: string;
  notes: string;
  source: string;
  status: TaskStatus;
  title: string;
  type: TaskType;
};

export function TaskEditForm({ task }: { task: EditableTask }) {
  const initialState: TaskFormState = {
    errors: {},
    message: "",
    status: "idle",
    values: {
      dueAt: task.dueAtInput,
      isDaily: task.isDaily ? "on" : "",
      isLongRunning: task.isLongRunning ? "on" : "",
      isPlannedToday: task.isPlannedToday ? "on" : "",
      nextAction: task.nextAction,
      notes: task.notes,
      source: task.source,
      status: task.status,
      title: task.title,
      type: task.type,
    },
  };
  const [state, formAction] = useActionState(updateTaskAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 border border-neutral-200 bg-white p-4">
      <input name="id" type="hidden" value={task.id} />
      <FormMessage message={state.message} />

      <label className="grid gap-1 text-sm">
        <span className="text-neutral-600">标题</span>
        <input className="field" name="title" defaultValue={state.values.title} />
        <FieldError messages={state.errors.title} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-neutral-600">类型</span>
          <select className="field" name="type" defaultValue={state.values.type}>
            {TASK_TYPES.map((type) => (
              <option key={type} value={type}>
                {TASK_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <FieldError messages={state.errors.type} />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-neutral-600">状态</span>
          <select className="field" name="status" defaultValue={state.values.status}>
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {TASK_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <FieldError messages={state.errors.status} />
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="text-neutral-600">来源</span>
        <input className="field" name="source" defaultValue={state.values.source} />
        <FieldError messages={state.errors.source} />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-neutral-600">截止时间</span>
        <input className="field" name="dueAt" type="datetime-local" defaultValue={state.values.dueAt} />
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
        <input className="field" name="nextAction" defaultValue={state.values.nextAction} />
        <FieldError messages={state.errors.nextAction} />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="text-neutral-600">备注</span>
        <textarea className="field min-h-32 resize-y" name="notes" defaultValue={state.values.notes} />
        <FieldError messages={state.errors.notes} />
      </label>

      <div className="flex gap-3">
        <SubmitButton />
        <Link
          className="h-10 border border-neutral-300 px-4 py-2 text-sm text-neutral-950 transition hover:border-neutral-950"
          href="/"
        >
          取消
        </Link>
      </div>
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

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="h-10 border border-neutral-950 bg-neutral-950 px-4 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-500"
      disabled={pending}
    >
      {pending ? "保存中..." : "保存修改"}
    </button>
  );
}
