import Link from "next/link";
import { notFound } from "next/navigation";

import { updateTaskAction } from "@/lib/tasks/actions";
import {
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  TASK_TYPE_LABELS,
  TASK_TYPES,
  toChinaDateTimeInput,
} from "@/lib/tasks/domain";
import { getTask } from "@/lib/tasks/service";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditTaskPage({ params }: PageProps) {
  const { id } = await params;
  const task = await getTask(id);

  if (!task) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-neutral-200 pb-5">
        <Link className="text-sm text-neutral-500 transition hover:text-neutral-950" href="/">
          返回任务列表
        </Link>
        <h1 className="mt-3 text-3xl font-semibold text-neutral-950">编辑任务</h1>
      </header>

      <form action={updateTaskAction} className="grid gap-4 border border-neutral-200 bg-white p-4">
        <input name="id" type="hidden" value={task.id} />

        <label className="grid gap-1 text-sm">
          <span className="text-neutral-600">标题</span>
          <input className="field" name="title" defaultValue={task.title} required />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-neutral-600">类型</span>
            <select className="field" name="type" defaultValue={task.type}>
              {TASK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TASK_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-neutral-600">状态</span>
            <select className="field" name="status" defaultValue={task.status}>
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {TASK_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="grid gap-1 text-sm">
          <span className="text-neutral-600">来源</span>
          <input className="field" name="source" defaultValue={task.source} />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-neutral-600">截止时间</span>
          <input
            className="field"
            name="dueAt"
            type="datetime-local"
            defaultValue={toChinaDateTimeInput(task.dueAt)}
          />
        </label>

        <label className="flex items-start gap-2 border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
          <input
            className="mt-1"
            defaultChecked={task.isLongRunning}
            name="isLongRunning"
            type="checkbox"
          />
          <span>这是大跨度任务 / 需要持续推进</span>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-neutral-600">下一步动作</span>
          <input className="field" name="nextAction" defaultValue={task.nextAction} />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-neutral-600">备注</span>
          <textarea className="field min-h-32 resize-y" name="notes" defaultValue={task.notes} />
        </label>

        <div className="flex gap-3">
          <button className="h-10 border border-neutral-950 bg-neutral-950 px-4 text-sm font-medium text-white transition hover:bg-neutral-800">
            保存修改
          </button>
          <Link
            className="h-10 border border-neutral-300 px-4 py-2 text-sm text-neutral-950 transition hover:border-neutral-950"
            href="/"
          >
            取消
          </Link>
        </div>
      </form>
    </main>
  );
}
