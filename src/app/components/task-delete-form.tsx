"use client";

import { deleteTaskAction } from "@/lib/tasks/actions";

export function TaskDeleteForm({ taskId, taskTitle }: { taskId: string; taskTitle: string }) {
  return (
    <form
      action={deleteTaskAction}
      onSubmit={(event) => {
        if (!window.confirm(`确定删除“${taskTitle}”吗？`)) {
          event.preventDefault();
        }
      }}
    >
      <input name="id" type="hidden" value={taskId} />
      <button className="h-9 border border-neutral-200 px-3 text-sm text-neutral-500 transition hover:border-red-300 hover:text-red-700">
        删除
      </button>
    </form>
  );
}
