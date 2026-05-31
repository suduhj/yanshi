import { createDeepSeekCompletion } from "../ai/deepseek";

import { summarizeTaskEventsByType } from "./events";

export type RecapEvent = {
  summary: string;
  taskTitle: string;
  type: string;
};

export function buildLocalDailyRecap(events: RecapEvent[]) {
  if (events.length === 0) {
    return "今天还没有留下复盘记录。可以先完成、推进或重新安排一项任务。";
  }

  const grouped = summarizeTaskEventsByType(events);
  const lines = ["今日小结："];

  if (grouped.completed.length > 0) {
    lines.push(`完成了 ${grouped.completed.length} 项：${formatTitles(grouped.completed)}。`);
  }

  if (grouped.progressCompleted.length > 0) {
    lines.push(`推进了 ${grouped.progressCompleted.length} 项：${formatTitles(grouped.progressCompleted)}。`);
  }

  if (grouped.rescheduled.length > 0) {
    lines.push(`重新安排了 ${grouped.rescheduled.length} 项：${formatTitles(grouped.rescheduled)}。`);
  }

  if (grouped.nextActionUpdated.length > 0) {
    lines.push(`补充了 ${grouped.nextActionUpdated.length} 项下一步：${formatTitles(grouped.nextActionUpdated)}。`);
  }

  lines.push("下一步可以优先处理今日必须完成和待确认事项。");

  return lines.join("\n");
}

export async function generateDailyAiRecap(events: RecapEvent[]) {
  const fallback = buildLocalDailyRecap(events);
  const eventText = events.map((event) => `- ${event.summary}`).join("\n");
  const completion = await createDeepSeekCompletion({
    messages: [
      {
        content: "你是砚时的复盘助手。请用温和、具体、简短的中文帮助用户总结今天的任务处理情况，并给出下一步建议。不要编造不存在的任务，不要声称已经替用户处理任务。",
        role: "system",
      },
      {
        content: `今天的任务事件：\n${eventText || "暂无事件"}\n\n请生成今日回顾。`,
        role: "user",
      },
    ],
    responseFormat: "text",
  });

  if (!completion.ok) {
    return {
      message: completion.reason,
      source: "local" as const,
      text: fallback,
    };
  }

  const text = completion.content.trim();

  return {
    source: text ? ("ai" as const) : ("local" as const),
    text: text || fallback,
  };
}

function formatTitles(events: RecapEvent[]) {
  return events.map((event) => event.taskTitle).join("、");
}
