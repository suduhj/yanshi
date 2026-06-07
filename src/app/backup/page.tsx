import Link from "next/link";

import { RestoreBackupButton } from "@/app/components/restore-backup-button";
import { createBackupAction, restoreBackupAction } from "@/lib/backup/actions";
import { ensureDailyBackup, listBackupFiles, readBackupFile } from "@/lib/backup/backup";
import { formatChinaDateTime } from "@/lib/tasks/domain";

type PageProps = {
  searchParams: Promise<{
    notice?: string;
  }>;
};

const NOTICE_MESSAGES: Record<string, string> = {
  backupCreated: "已创建备份。",
  backupFailed: "创建备份失败，请稍后重试。",
  invalidBackup: "备份文件无效。",
  restored: "已从备份恢复数据。",
  restoreFailed: "恢复备份失败，请检查备份文件。",
};

async function toBackupView(fileName: string) {
  try {
    const payload = await readBackupFile(fileName);

    return {
      eventCount: payload.taskEvents.length,
      exportedAt: formatChinaDateTime(new Date(payload.exportedAt)),
      fileName,
      taskCount: payload.tasks.length,
      valid: true,
    };
  } catch {
    return {
      eventCount: 0,
      exportedAt: "无法读取",
      fileName,
      taskCount: 0,
      valid: false,
    };
  }
}

export default async function BackupPage({ searchParams }: PageProps) {
  const params = await searchParams;

  await ensureDailyBackup();

  const backups = await listBackupFiles();
  const backupViews = await Promise.all(backups.map((backup) => toBackupView(backup.fileName)));
  const notice = params.notice ? NOTICE_MESSAGES[params.notice] : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-neutral-200 pb-5">
        <Link className="text-sm text-neutral-500 transition hover:text-neutral-950" href="/">
          返回任务列表
        </Link>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-neutral-500">本地数据保护</p>
            <h1 className="mt-1 text-3xl font-semibold text-neutral-950">备份管理</h1>
          </div>
          <form action={createBackupAction}>
            <button
              className="border border-neutral-950 bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
              type="submit"
            >
              立即备份
            </button>
          </form>
        </div>
      </header>

      {notice ? (
        <div className="border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
          {notice}
        </div>
      ) : null}

      <section className="border border-neutral-200 bg-white">
        <header className="border-b border-neutral-200 px-4 py-3">
          <h2 className="text-base font-semibold text-neutral-950">备份目录</h2>
          <p className="mt-1 text-sm text-neutral-500">prisma/backups/，默认保留最近 7 份。</p>
        </header>
        {backupViews.length === 0 ? (
          <p className="px-4 py-4 text-sm text-neutral-500">暂无备份。点击“立即备份”创建第一份备份。</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {backupViews.map((backup) => (
              <li
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                key={backup.fileName}
              >
                <div>
                  <p className="text-sm font-medium text-neutral-950">{backup.fileName}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {backup.exportedAt} · {backup.taskCount} 个任务 · {backup.eventCount} 条记录
                  </p>
                </div>
                <form action={restoreBackupAction}>
                  <input name="fileName" type="hidden" value={backup.fileName} />
                  <RestoreBackupButton disabled={!backup.valid} />
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
