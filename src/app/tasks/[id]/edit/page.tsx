import Link from "next/link";
import { notFound } from "next/navigation";

import { TaskEditForm } from "@/app/components/task-edit-form";
import { toChinaDateTimeInput } from "@/lib/tasks/domain";
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
    </main>
  );
}
