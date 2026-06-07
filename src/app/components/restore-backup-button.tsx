"use client";

export function RestoreBackupButton({ disabled = false }: { disabled?: boolean }) {
  return (
    <button
      className="border border-neutral-300 px-3 py-2 text-sm text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={(event) => {
        if (!window.confirm("确定要从这份备份恢复吗？当前任务数据会被覆盖。")) {
          event.preventDefault();
        }
      }}
      type="submit"
    >
      恢复
    </button>
  );
}
