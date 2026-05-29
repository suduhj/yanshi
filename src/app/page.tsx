import Link from "next/link";

import {
  DUE_FILTER_LABELS,
  DUE_FILTERS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  TASK_TYPE_LABELS,
  TASK_TYPES,
  buildTaskSections,
  buildTaskSummary,
  formatChinaDateTime,
  toTaskFilters,
  type DueFilter,
  type TaskStatus,
  type TaskType,
} from "@/lib/tasks/domain";
import { createTaskAction, deleteTaskAction } from "@/lib/tasks/actions";
import { listTasks, type TaskView } from "@/lib/tasks/service";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const filters = toTaskFilters(params);
  const tasks = await listTasks(filters);
  const summary = buildTaskSummary(tasks);
  const sections = buildTaskSections(tasks);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 border-b border-neutral-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm text-neutral-500">本地任务中枢</p>
          <h1 className="mt-1 text-3xl font-semibold text-neutral-950">大学生 AI 任务管家</h1>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-5 xl:w-[690px]">
          <SummaryItem label="全部任务" value={summary.total} />
          <SummaryItem label="逾期任务" value={summary.overdue} tone="danger" />
          <SummaryItem label="今天截止" value={summary.today} tone="focus" />
          <SummaryItem label="持续推进" value={summary.longRunning} />
          <SummaryItem label="已完成" value={summary.done} />
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="border border-neutral-200 bg-white p-4">
          <h2 className="text-base font-semibold text-neutral-950">新增任务</h2>
          <form action={createTaskAction} className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-neutral-600">标题</span>
              <input
                className="field"
                name="title"
                placeholder="例如：周五前交成图作业"
                required
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-neutral-600">类型</span>
              <select className="field" name="type" defaultValue="coursework">
                {TASK_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {TASK_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-neutral-600">来源</span>
              <input className="field" name="source" placeholder="课程、老师、活动或职责来源" />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-neutral-600">截止时间</span>
              <input className="field" name="dueAt" type="datetime-local" />
            </label>

            <label className="flex items-start gap-2 border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
              <input className="mt-1" name="isLongRunning" type="checkbox" />
              <span>这是大跨度任务 / 需要持续推进</span>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-neutral-600">下一步动作</span>
              <input className="field" name="nextAction" placeholder="例如：先完成底图、整理资料、列复习提纲" />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-neutral-600">备注</span>
              <textarea
                className="field min-h-24 resize-y"
                name="notes"
                placeholder="补充提交要求、资料位置、注意事项"
              />
            </label>

            <button className="mt-1 h-10 border border-neutral-950 bg-neutral-950 px-4 text-sm font-medium text-white transition hover:bg-neutral-800">
              添加任务
            </button>
          </form>
        </aside>

        <section className="flex min-w-0 flex-col gap-4">
          <form className="grid gap-3 border border-neutral-200 bg-white p-4 md:grid-cols-3">
            <FilterSelect
              label="状态"
              name="status"
              value={filters.status ?? "all"}
              options={[["all", "全部状态"], ...TASK_STATUSES.map((status) => [status, TASK_STATUS_LABELS[status]] as const)]}
            />
            <FilterSelect
              label="类型"
              name="type"
              value={filters.type ?? "all"}
              options={[["all", "全部类型"], ...TASK_TYPES.map((type) => [type, TASK_TYPE_LABELS[type]] as const)]}
            />
            <FilterSelect
              label="截止"
              name="due"
              value={filters.due ?? "all"}
              options={DUE_FILTERS.map((due) => [due, DUE_FILTER_LABELS[due]] as const)}
            />
            <div className="md:col-span-3">
              <button className="h-9 border border-neutral-300 px-4 text-sm text-neutral-950 transition hover:border-neutral-950">
                应用筛选
              </button>
            </div>
          </form>

          <TaskSection
            emptyText="今天没有必须完成的任务。"
            tasks={sections.todayMustDo}
            title="今日必须完成"
          />
          <TaskSection
            emptyText="暂时没有持续推进任务。"
            tasks={sections.longRunning}
            title="持续推进任务"
          />
          <TaskSection
            emptyText="暂无其他任务。"
            tasks={sections.other}
            title="其他任务"
          />
          <TaskSection
            emptyText="暂无已完成任务。"
            tasks={sections.done}
            title="已完成任务"
          />
        </section>
      </section>
    </main>
  );
}

function TaskSection({
  emptyText,
  tasks,
  title,
}: {
  emptyText: string;
  tasks: TaskView[];
  title: string;
}) {
  return (
    <section className="overflow-hidden border border-neutral-200 bg-white">
      <header className="border-b border-neutral-200 px-4 py-3">
        <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
      </header>
      {tasks.length === 0 ? (
        <div className="px-5 py-8 text-sm text-neutral-500">{emptyText}</div>
      ) : (
        <ul className="divide-y divide-neutral-200">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </ul>
      )}
    </section>
  );
}

function TaskItem({ task }: { task: TaskView }) {
  return (
    <li className="grid gap-4 px-4 py-4 md:grid-cols-[1fr_150px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="tag">{TASK_TYPE_LABELS[task.type]}</span>
          <span className="tag">{task.systemPriority.label}</span>
          <span className="tag">{TASK_STATUS_LABELS[task.status]}</span>
          {task.isLongRunning ? <span className="tag">持续推进</span> : null}
        </div>
        <h3 className="mt-2 truncate text-base font-semibold text-neutral-950">{task.title}</h3>
        <p className="mt-1 text-sm text-neutral-500">
          {task.source || "未填写来源"} · 截止 {formatChinaDateTime(task.dueAt)}
        </p>
        {task.nextAction ? (
          <p className="mt-2 text-sm font-medium text-neutral-900">下一步：{task.nextAction}</p>
        ) : null}
        {task.notes ? (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{task.notes}</p>
        ) : null}
      </div>

      <div className="flex items-start gap-2 md:justify-end">
        <Link
          className="h-9 border border-neutral-300 px-3 py-1.5 text-sm transition hover:border-neutral-950"
          href={`/tasks/${task.id}/edit`}
        >
          编辑
        </Link>
        <form action={deleteTaskAction}>
          <input name="id" type="hidden" value={task.id} />
          <button className="h-9 border border-red-200 px-3 text-sm text-red-700 transition hover:border-red-600">
            删除
          </button>
        </form>
      </div>
    </li>
  );
}

function SummaryItem({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: number;
  tone?: "danger" | "focus" | "normal";
}) {
  const toneClass =
    tone === "danger" ? "text-red-700" : tone === "focus" ? "text-amber-700" : "text-neutral-950";

  return (
    <div className="border border-neutral-200 bg-white px-3 py-2">
      <div className={`text-xl font-semibold ${toneClass}`}>{value}</div>
      <div className="mt-1 text-xs text-neutral-500">{label}</div>
    </div>
  );
}

function FilterSelect({
  label,
  name,
  options,
  value,
}: {
  label: string;
  name: string;
  options: readonly (readonly [string, string])[];
  value: DueFilter | TaskStatus | TaskType | "all";
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-neutral-600">{label}</span>
      <select className="field h-9" name={name} defaultValue={value}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
