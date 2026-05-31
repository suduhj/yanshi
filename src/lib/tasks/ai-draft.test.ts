import { describe, expect, it } from "vitest";

import { parseTaskDraftFromText } from "./ai-draft";

const now = new Date("2026-05-29T04:00:00.000Z"); // 2026-05-29 12:00 in China.

describe("parseTaskDraftFromText", () => {
  it("returns task form values from a DeepSeek JSON draft", async () => {
    const result = await parseTaskDraftFromText("明天晚上八点交成图作业", {
      complete: async () => ({
        content: JSON.stringify({
          dueAt: "2026-05-30T20:00",
          isDaily: false,
          isLongRunning: false,
          isPlannedToday: true,
          nextAction: "完成成图作业",
          notes: "记得检查提交格式",
          source: "成图课",
          title: "交成图作业",
          type: "drawing",
        }),
        ok: true,
      }),
      now,
    });

    expect(result).toEqual({
      aiInput: "明天晚上八点交成图作业",
      aiMessage: "已解析为任务草稿，请检查后添加。",
      ok: true,
      values: {
        dueAt: "2026-05-30T20:00",
        isDaily: "",
        isLongRunning: "",
        isPlannedToday: "on",
        nextAction: "完成成图作业",
        notes: "记得检查提交格式",
        source: "成图课",
        title: "交成图作业",
        type: "drawing",
      },
    });
  });

  it("falls back to life when the model returns an unknown task type", async () => {
    const result = await parseTaskDraftFromText("买洗衣液", {
      complete: async () => ({
        content: JSON.stringify({
          dueAt: "",
          title: "买洗衣液",
          type: "shopping",
        }),
        ok: true,
      }),
      now,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.type).toBe("life");
      expect(result.values.dueAt).toBe("");
    }
  });

  it("keeps the input and returns a Chinese error when the model output is invalid", async () => {
    const result = await parseTaskDraftFromText("   ", {
      complete: async () => ({
        content: "{}",
        ok: true,
      }),
      now,
    });

    expect(result).toEqual({
      aiInput: "   ",
      aiMessage: "请先输入要解析的任务描述。",
      ok: false,
      values: {},
    });
  });

  it("returns a Chinese error for non-JSON model output", async () => {
    const result = await parseTaskDraftFromText("帮我记一下作业", {
      complete: async () => ({
        content: "标题：作业",
        ok: true,
      }),
      now,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.aiInput).toBe("帮我记一下作业");
      expect(result.aiMessage).toBe("DeepSeek 返回的任务草稿不是有效 JSON，请重试。");
    }
  });
});
