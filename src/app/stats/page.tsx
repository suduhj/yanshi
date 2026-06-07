import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { formatChinaDateTime } from "@/lib/tasks/domain";
import { buildStatsDashboardData } from "@/lib/tasks/stats";

export default async function StatsPage() {
  const now = new Date();
  const [tasks, events] = await Promise.all([
    prisma.task.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.taskEvent.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  const data = buildStatsDashboardData(tasks, events, now);
  const maxTrendValue = Math.max(
    1,
    ...data.trend.map((day) => day.completed + day.progress + day.rescheduled),
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-neutral-200 pb-5">
        <Link className="text-sm text-neutral-500 transition hover:text-neutral-950" href="/">
          返回任务列表
        </Link>
        <div className="mt-3">
          <p className="text-sm text-neutral-500">复盘统计</p>
          <h1 className="mt-1 text-3xl font-semibold text-neutral-950">近 7 天任务处理</h1>
          <p className="mt-2 text-sm text-neutral-600">基于复盘记录和当前任务，查看完成趋势与任务分布。</p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewCard label="近 7 天完成" value={data.overview.completed} />
        <OverviewCard label="近 7 天推进" value={data.overview.progress} />
        <OverviewCard label="重新安排" value={data.overview.rescheduled} />
        <OverviewCard label="今日记录" value={data.overview.todayRecords} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="border border-neutral-200 bg-white">
          <header className="border-b border-neutral-200 px-4 py-3">
            <h2 className="text-base font-semibold text-neutral-950">近 7 天趋势</h2>
          </header>
          {events.length === 0 ? (
            <p className="px-4 py-4 text-sm text-neutral-500">还没有复盘记录。完成、推进或重新安排任务后，这里会出现趋势。</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.trend.map((day) => (
                <li className="grid gap-3 px-4 py-3 sm:grid-cols-[92px_1fr]" key={day.chinaDateKey}>
                  <p className="text-sm text-neutral-500">{day.chinaDateKey}</p>
                  <div className="min-w-0">
                    <StackedTrendBar day={day} max={maxTrendValue} />
                    <p className="mt-2 text-xs text-neutral-500">
                      完成 {day.completed} · 推进 {day.progress} · 调整 {day.rescheduled}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-neutral-200 bg-white">
          <header className="border-b border-neutral-200 px-4 py-3">
            <h2 className="text-base font-semibold text-neutral-950">最近复盘记录</h2>
          </header>
          {data.recentEvents.length === 0 ? (
            <p className="px-4 py-4 text-sm text-neutral-500">暂无复盘记录。</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.recentEvents.map((event) => (
                <li className="px-4 py-3" key={event.id}>
                  <p className="text-sm text-neutral-950">{event.summary}</p>
                  <p className="mt-1 text-xs text-neutral-500">{formatChinaDateTime(event.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <DistributionPanel
          emptyText="暂无任务数据。"
          items={data.typeDistribution}
          title="任务类型分布"
        />
        <DistributionPanel
          emptyText="暂无任务数据。"
          items={data.sourceDistribution}
          title="任务来源分布"
        />
      </section>
    </main>
  );
}

function OverviewCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-neutral-200 bg-white px-4 py-3">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-neutral-950">{value}</p>
    </div>
  );
}

function DistributionPanel({
  emptyText,
  items,
  title,
}: {
  emptyText: string;
  items: Array<{
    count: number;
    label: string;
    ratio: number;
  }>;
  title: string;
}) {
  return (
    <section className="border border-neutral-200 bg-white">
      <header className="border-b border-neutral-200 px-4 py-3">
        <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
      </header>
      {items.length === 0 ? (
        <p className="px-4 py-4 text-sm text-neutral-500">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.map((item) => (
            <li className="px-4 py-3" key={item.label}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium text-neutral-950">{item.label}</p>
                <p className="shrink-0 text-sm text-neutral-500">{item.count}</p>
              </div>
              <RatioBar ratio={item.ratio} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RatioBar({ ratio }: { ratio: number }) {
  return (
    <div className="h-2 overflow-hidden bg-neutral-100">
      <div className="h-full bg-neutral-950" style={{ width: `${Math.round(ratio * 100)}%` }} />
    </div>
  );
}

function StackedTrendBar({
  day,
  max,
}: {
  day: {
    completed: number;
    progress: number;
    rescheduled: number;
  };
  max: number;
}) {
  const completedWidth = (day.completed / max) * 100;
  const progressWidth = (day.progress / max) * 100;
  const rescheduledWidth = (day.rescheduled / max) * 100;

  return (
    <div className="flex h-3 overflow-hidden bg-neutral-100">
      <div className="bg-neutral-950" style={{ width: `${completedWidth}%` }} />
      <div className="bg-emerald-500" style={{ width: `${progressWidth}%` }} />
      <div className="bg-amber-500" style={{ width: `${rescheduledWidth}%` }} />
    </div>
  );
}
