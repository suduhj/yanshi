"use client";

import { useActionState } from "react";

import { generateDailyRecapAction, type DailyRecapState } from "@/lib/tasks/recap-actions";

const initialState: DailyRecapState = {
  message: "",
  source: "",
};

export function DailyRecapActionPanel() {
  const [state, formAction, pending] = useActionState(generateDailyRecapAction, initialState);

  return (
    <div className="grid gap-3">
      <form action={formAction}>
        <button
          className="h-9 border border-neutral-950 bg-neutral-950 px-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:border-neutral-400 disabled:bg-neutral-400"
          disabled={pending}
        >
          {pending ? "生成中" : "生成 AI 回顾"}
        </button>
      </form>
      {state.message ? (
        <div className="whitespace-pre-wrap border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm leading-6 text-neutral-700">
          {state.message}
          {state.source === "local" ? <p className="mt-2 text-xs text-neutral-500">当前显示本地规则小结。</p> : null}
        </div>
      ) : null}
    </div>
  );
}
