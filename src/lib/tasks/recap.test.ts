import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../ai/deepseek", () => ({
  createDeepSeekCompletion: vi.fn(),
}));

const deepseek = await import("../ai/deepseek");
const recap = await import("./recap");

describe("daily recap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a local recap grouped by event type", () => {
    const text = recap.buildLocalDailyRecap([
      { summary: "完成任务：复习高数", taskTitle: "复习高数", type: "task_completed" },
      { summary: "今日推进：竞赛作品", taskTitle: "竞赛作品", type: "progress_completed" },
      { summary: "推迟截止时间：提交材料", taskTitle: "提交材料", type: "due_postponed" },
    ]);

    expect(text).toContain("完成了 1 项：复习高数。");
    expect(text).toContain("推进了 1 项：竞赛作品。");
    expect(text).toContain("重新安排了 1 项：提交材料。");
  });

  it("returns a local empty-state recap when there are no events", () => {
    expect(recap.buildLocalDailyRecap([])).toBe("今天还没有留下复盘记录。可以先完成、推进或重新安排一项任务。");
  });

  it("uses DeepSeek when AI recap succeeds", async () => {
    vi.mocked(deepseek.createDeepSeekCompletion).mockResolvedValue({
      content: "今天完成了复习，也推进了竞赛作品。下一步先处理提交材料。",
      ok: true,
    });

    const result = await recap.generateDailyAiRecap([
      { summary: "完成任务：复习高数", taskTitle: "复习高数", type: "task_completed" },
    ]);

    expect(result).toEqual({
      source: "ai",
      text: "今天完成了复习，也推进了竞赛作品。下一步先处理提交材料。",
    });
  });

  it("falls back to local recap when DeepSeek fails", async () => {
    vi.mocked(deepseek.createDeepSeekCompletion).mockResolvedValue({
      ok: false,
      reason: "未配置 DeepSeek API Key",
    });

    const result = await recap.generateDailyAiRecap([
      { summary: "今日推进：竞赛作品", taskTitle: "竞赛作品", type: "progress_completed" },
    ]);

    expect(result.source).toBe("local");
    expect(result.text).toContain("推进了 1 项：竞赛作品。");
    expect(result.message).toBe("未配置 DeepSeek API Key");
  });
});
