import Link from "next/link";

import { ReminderNotificationControls } from "@/app/components/reminder-notification-controls";
import { TaskFocusHighlighter } from "@/app/components/task-focus-highlighter";
import { TaskCreateForm } from "@/app/components/task-create-form";
import { TaskDeleteForm } from "@/app/components/task-delete-form";
import { runReminderCheck, type Reminder } from "@/lib/agent/reminder";
import {
  completeDailyTodayAction,
  completeLongRunningProgressTodayAction,
  completeTaskAction,
  markUnfinishedPlannedTodayAction,
  postponeTaskDueAtAction,
  togglePlannedTodayAction,
  updateTaskNextActionAction,
} from "@/lib/tasks/actions";
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
  formatDueDistance,
  getChinaDateKey,
  isDailyCompletedToday,
  isNeedsConfirmation,
  toTaskFilters,
  toTaskViewFilter,
  type DueFilter,
  type TaskViewFilter,
  type TaskStatus,
  type TaskType,
} from "@/lib/tasks/domain";
import { listTasks, type TaskView } from "@/lib/tasks/service";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const filters = toTaskFilters(params);
  const view = toTaskViewFilter(params.view);
  const focusTask = getParamValue(params.focusTask);
  const now = new Date();
  const tasks = await listTasks(filters);
  const summary = buildTaskSummary(tasks, now);
  const sections = buildTaskSections(tasks, now);
  const reminderCheck = await runReminderCheck(tasks, now);
  const notice = getNotice(params.notice);
  const visibleSections = getVisibleSections(sections, view);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      {focusTask ? <TaskFocusHighlighter taskId={focusTask} /> : null}
      <header className="flex flex-col gap-3 border-b border-neutral-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm text-neutral-500">本地任务中枢</p>
          <h1 className="mt-1 text-3xl font-semibold text-neutral-950">砚时</h1>
          <p className="mt-2 text-sm text-neutral-600">于书砚之间，理清每日之事。</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4 xl:w-[920px] xl:grid-cols-8">
          <SummaryItem active={view === "all"} href="/?view=all#task-list" label="全部任务" value={summary.total} />
          <SummaryItem active={view === "needsConfirmation"} href="/?view=needsConfirmation#task-list" label="待确认" value={summary.needsConfirmation} tone="focus" />
          <SummaryItem active={view === "todayMustDo"} href="/?view=todayMustDo#task-list" label="今天截止" value={summary.today} tone="focus" />
          <SummaryItem active={view === "plannedToday"} href="/?view=plannedToday#task-list" label="今日要做" value={summary.plannedToday} />
          <SummaryItem active={view === "daily"} href="/?view=daily#task-list" label="每日任务" value={summary.daily} />
          <SummaryItem active={view === "longRunning"} href="/?view=longRunning#task-list" label="持续推进" value={summary.longRunning} />
          <SummaryItem active={view === "other"} href="/?view=other#task-list" label="其他任务" value={summary.other} />
          <SummaryItem active={view === "done"} href="/?view=done#task-list" label="已完成" value={summary.done} />
        </div>
      </header>

      {notice ? (
        <div className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}

      <ReminderPanel chinaDateKey={getChinaDateKey(now)} reminders={reminderCheck.reminders} />
      <MorningReviewPanel tasks={sections.needsConfirmation} />

      <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="border border-neutral-200 bg-white p-4">
          <h2 className="text-base font-semibold text-neutral-950">新增任务</h2>
          <TaskCreateForm />
        </aside>

        <section className="flex min-w-0 flex-col gap-4" id="task-list">
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

          {visibleSections.map((section) => (
            <TaskSection
              emptyText={section.emptyText}
              key={section.key}
              tasks={section.tasks}
              title={section.title}
            />
          ))}
        </section>
      </section>
    </main>
  );
}

function ReminderPanel({
  chinaDateKey,
  reminders,
}: {
  chinaDateKey: string;
  reminders: Reminder[];
}) {
  if (reminders.length === 0) {
    return null;
  }

  return (
    <section className="border border-neutral-200 bg-white">
      <header className="border-b border-neutral-200 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-neutral-950">提醒建议</h2>
          <ReminderNotificationControls chinaDateKey={chinaDateKey} reminders={reminders} />
        </div>
      </header>
      <ul className="divide-y divide-neutral-100">
        {reminders.map((reminder) => (
          <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" key={reminder.id}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-neutral-950">{reminder.title}</p>
              <p className="mt-1 text-sm text-neutral-500">{reminder.detail}</p>
            </div>
            <Link className={`tag shrink-0 transition hover:border-neutral-950 ${getReminderToneClass(reminder.level)}`} href={getReminderHref(reminder)}>
              {getReminderLevelLabel(reminder.level)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MorningReviewPanel({ tasks }: { tasks: TaskView[] }) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <section className="border border-amber-200 bg-amber-50/70">
      <header className="border-b border-amber-200 px-4 py-3">
        <p className="text-sm text-amber-800">晨间回砚</p>
        <h2 className="mt-1 text-lg font-semibold text-neutral-950">
          有 {tasks.length} 项任务已经过了截止时间，请先确认一下。
        </h2>
      </header>
      <ul className="divide-y divide-amber-100">
        {tasks.map((task) => (
          <li className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_auto]" key={task.id}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-neutral-950">{task.title}</p>
              <p className="mt-1 text-sm text-amber-800">截止 {formatChinaDateTime(task.dueAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <CompleteTaskButton taskId={task.id} />
              <MarkUnfinishedTodayButton taskId={task.id} />
              <PostponeDueAtForm taskId={task.id} />
              <NextActionForm label="拆成下一步" taskId={task.id} />
            </div>
          </li>
        ))}
      </ul>
    </section>
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
  const needsConfirmation = isNeedsConfirmation(task);

  return (
    <li className="grid scroll-mt-8 gap-4 px-4 py-4 transition-colors md:grid-cols-[1fr_260px]" id={`task-${task.id}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="tag">{TASK_TYPE_LABELS[task.type]}</span>
          <span className="tag">{task.systemPriority.label}</span>
          <span className="tag">{TASK_STATUS_LABELS[task.status]}</span>
          {needsConfirmation ? <span className="tag border-amber-200 bg-amber-50 text-amber-800">待确认</span> : null}
          {task.isLongRunning ? <span className="tag">持续推进</span> : null}
        </div>
        <h3 className="mt-2 truncate text-base font-semibold text-neutral-950">{task.title}</h3>
        <p className="mt-1 text-sm text-neutral-500">
          {task.source || "未填写来源"} · 截止 {formatChinaDateTime(task.dueAt)}
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          {needsConfirmation ? "已过截止，请确认是否完成" : formatDueDistance(task.dueAt)}
        </p>
        {task.nextAction ? (
          <p className="mt-2 text-sm font-medium text-neutral-900">下一步：{task.nextAction}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="tag">{task.isPlannedToday ? "已加入今日" : "未加入今日"}</span>
          <span className="tag">{task.isDaily ? "每日任务" : "非每日任务"}</span>
          <span className="tag">{task.isLongRunning ? "持续推进任务" : "非持续推进"}</span>
          {task.isDaily ? (
            <span className="tag">{isDailyCompletedToday(task) ? "今日已完成" : "今日未完成"}</span>
          ) : null}
        </div>
        {task.notes ? (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{task.notes}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start gap-2 md:justify-end">
        {task.status !== "done" && !task.isDaily && !task.isLongRunning ? (
          <CompleteTaskButton taskId={task.id} />
        ) : null}
        {task.isLongRunning && task.status !== "done" ? (
          <>
            <LongRunningProgressButton taskId={task.id} />
            <CompleteTaskButton label="标记整个任务完成" taskId={task.id} />
            <NextActionForm taskId={task.id} />
          </>
        ) : null}
        {!task.isDaily && task.status !== "done" ? (
          <PlannedTodayButton taskId={task.id} isPlannedToday={task.isPlannedToday} />
        ) : null}
        {!task.isDaily && task.status !== "done" ? <PostponeDueAtForm taskId={task.id} /> : null}
        {task.isDaily ? (
          <DailyCompleteButton taskId={task.id} completed={isDailyCompletedToday(task)} />
        ) : null}
        <Link
          className="h-9 border border-neutral-300 px-3 py-1.5 text-sm transition hover:border-neutral-950"
          href={`/tasks/${task.id}/edit`}
        >
          编辑
        </Link>
        <TaskDeleteForm taskId={task.id} taskTitle={task.title} />
      </div>
    </li>
  );
}

function PlannedTodayButton({ isPlannedToday, taskId }: { isPlannedToday: boolean; taskId: string }) {
  return (
    <form action={togglePlannedTodayAction}>
      <input name="id" type="hidden" value={taskId} />
      <input name="isPlannedToday" type="hidden" value={isPlannedToday ? "false" : "true"} />
      <button className="h-9 border border-neutral-300 px-3 text-sm text-neutral-950 transition hover:border-neutral-950">
        {isPlannedToday ? "移出今日" : "加入今日"}
      </button>
    </form>
  );
}

function CompleteTaskButton({ label = "完成", taskId }: { label?: string; taskId: string }) {
  return (
    <form action={completeTaskAction}>
      <input name="id" type="hidden" value={taskId} />
      <button className="h-9 border border-neutral-950 bg-neutral-950 px-3 text-sm font-medium text-white transition hover:bg-neutral-800">
        {label}
      </button>
    </form>
  );
}

function MarkUnfinishedTodayButton({ taskId }: { taskId: string }) {
  return (
    <form action={markUnfinishedPlannedTodayAction}>
      <input name="id" type="hidden" value={taskId} />
      <button className="h-9 border border-amber-300 bg-white px-3 text-sm text-amber-900 transition hover:border-amber-700">
        未完成，加入今日
      </button>
    </form>
  );
}

function LongRunningProgressButton({ taskId }: { taskId: string }) {
  return (
    <form action={completeLongRunningProgressTodayAction}>
      <input name="id" type="hidden" value={taskId} />
      <button className="h-9 border border-neutral-950 bg-neutral-950 px-3 text-sm font-medium text-white transition hover:bg-neutral-800">
        今日推进完成
      </button>
    </form>
  );
}

function PostponeDueAtForm({ taskId }: { taskId: string }) {
  return (
    <form action={postponeTaskDueAtAction} className="flex h-9 overflow-hidden border border-neutral-300 bg-white focus-within:border-neutral-950">
      <input name="id" type="hidden" value={taskId} />
      <input
        aria-label="推迟截止时间"
        className="w-[150px] px-2 text-xs outline-none"
        name="dueAt"
        type="datetime-local"
      />
      <button className="border-l border-neutral-300 px-2 text-sm text-neutral-950 transition hover:bg-neutral-50">
        推迟
      </button>
    </form>
  );
}

function NextActionForm({ label = "更新下一步", taskId }: { label?: string; taskId: string }) {
  return (
    <form action={updateTaskNextActionAction} className="flex h-9 overflow-hidden border border-neutral-300 bg-white focus-within:border-neutral-950">
      <input name="id" type="hidden" value={taskId} />
      <input
        aria-label="下一步动作"
        className="w-[130px] px-2 text-xs outline-none"
        maxLength={240}
        name="nextAction"
        placeholder="下一步"
      />
      <button className="border-l border-neutral-300 px-2 text-sm text-neutral-950 transition hover:bg-neutral-50">
        {label}
      </button>
    </form>
  );
}

function DailyCompleteButton({ completed, taskId }: { completed: boolean; taskId: string }) {
  return (
    <form action={completeDailyTodayAction}>
      <input name="id" type="hidden" value={taskId} />
      <button
        className="h-9 border border-neutral-300 px-3 text-sm text-neutral-950 transition hover:border-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
        disabled={completed}
      >
        {completed ? "今日已完成" : "完成今日"}
      </button>
    </form>
  );
}

function getNotice(value: string | string[] | undefined) {
  const notice = Array.isArray(value) ? value[0] : value;

  if (notice === "created") {
    return "任务已添加";
  }
  if (notice === "updated") {
    return "任务已更新";
  }
  if (notice === "deleted") {
    return "任务已删除";
  }
  if (notice === "completed") {
    return "任务已完成";
  }
  if (notice === "plannedToday") {
    return "已加入今日计划";
  }
  if (notice === "removedToday") {
    return "已移出今日计划";
  }
  if (notice === "dailyCompleted") {
    return "每日任务今日已完成";
  }
  if (notice === "postponed") {
    return "截止时间已更新";
  }
  if (notice === "nextActionUpdated") {
    return "下一步动作已更新";
  }
  if (notice === "progressCompleted") {
    return "今日推进已记录";
  }
  if (notice === "invalidDueAt") {
    return "截止时间格式不正确";
  }

  return "";
}

function SummaryItem({
  active = false,
  href,
  label,
  value,
  tone = "normal",
}: {
  active?: boolean;
  href: string;
  label: string;
  value: number;
  tone?: "danger" | "focus" | "normal";
}) {
  const toneClass =
    tone === "danger" ? "text-red-700" : tone === "focus" ? "text-amber-700" : "text-neutral-950";

  return (
    <Link className={`border bg-white px-3 py-2 transition hover:border-neutral-950 ${active ? "border-neutral-950" : "border-neutral-200"}`} href={href}>
      <div className={`text-xl font-semibold ${toneClass}`}>{value}</div>
      <div className="mt-1 text-xs text-neutral-500">{label}</div>
    </Link>
  );
}

function getReminderLevelLabel(level: Reminder["level"]) {
  if (level === "danger") {
    return "优先处理";
  }
  if (level === "focus") {
    return "今天关注";
  }

  return "补充动作";
}

function getReminderToneClass(level: Reminder["level"]) {
  if (level === "danger") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (level === "focus") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-sky-200 bg-sky-50 text-sky-800";
}

function getReminderHref(reminder: Reminder) {
  const view = reminder.id.startsWith("confirm:")
    ? "needsConfirmation"
    : reminder.id.startsWith("daily:")
      ? "daily"
      : reminder.id.startsWith("long-running:")
        ? "longRunning"
        : "todayMustDo";

  return `/?view=${view}&focusTask=${reminder.taskId}#task-${reminder.taskId}`;
}

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getVisibleSections(
  sections: ReturnType<typeof buildTaskSections<TaskView>>,
  view: TaskViewFilter,
) {
  const allSections = [
    {
      emptyText: "没有需要确认的任务。",
      key: "needsConfirmation",
      tasks: sections.needsConfirmation,
      title: "待确认",
    },
    {
      emptyText: "今天没有必须完成的任务。",
      key: "todayMustDo",
      tasks: sections.todayMustDo,
      title: "今日必须完成",
    },
    {
      emptyText: "今日计划还是空的。",
      key: "plannedToday",
      tasks: sections.plannedToday,
      title: "今日要做",
    },
    {
      emptyText: "暂无每日任务。",
      key: "daily",
      tasks: sections.daily,
      title: "每日任务",
    },
    {
      emptyText: "暂时没有持续推进任务。",
      key: "longRunning",
      tasks: sections.longRunning,
      title: "持续推进任务",
    },
    {
      emptyText: "暂无其他任务。",
      key: "other",
      tasks: sections.other,
      title: "其他任务",
    },
    {
      emptyText: "暂无已完成任务。",
      key: "done",
      tasks: sections.done,
      title: "已完成任务",
    },
  ] as const;

  if (view === "all") {
    return allSections;
  }

  return allSections.filter((section) => section.key === view);
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
