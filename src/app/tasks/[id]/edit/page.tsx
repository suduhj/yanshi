import Link from "next/link";
import { notFound } from "next/navigation";

import { TaskEditForm } from "@/app/components/task-edit-form";
import { formatChinaDateTime, toChinaDateTimeInput } from "@/lib/tasks/domain";
import { listRecentTaskEvents } from "@/lib/tasks/events";
import { getTask } from "@/lib/tasks/service";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditTaskPage({ params }: PageProps) {
  const { id } = await params;
  const [task, events] = await Promise.all([
    getTask(id),
    listRecentTaskEvents(id),
  ]);

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

      <TaskEditForm
        task={{
          dueAtInput: toChinaDateTimeInput(task.dueAt),
          id: task.id,
          isDaily: task.isDaily,
          isLongRunning: task.isLongRunning,
          isPlannedToday: task.isPlannedToday,
          nextAction: task.nextAction,
          notes: task.notes,
          source: task.source,
          status: task.status,
          title: task.title,
          type: task.type,
        }}
      />

      <section className="border border-neutral-200 bg-white">
        <header className="border-b border-neutral-200 px-4 py-3">
          <h2 className="text-base font-semibold text-neutral-950">最近记录</h2>
        </header>
        {events.length === 0 ? (
          <p className="px-4 py-3 text-sm text-neutral-500">这个任务还没有复盘记录。</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {events.map((event) => (
              <li className="px-4 py-3" key={event.id}>
                <p className="text-sm text-neutral-950">{event.summary}</p>
                <p className="mt-1 text-xs text-neutral-500">{formatChinaDateTime(event.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
