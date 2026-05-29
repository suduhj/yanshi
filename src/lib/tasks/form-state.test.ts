import { describe, expect, it } from "vitest";

import { parseCreateTaskForm, parseUpdateTaskForm } from "./form-state";

function makeFormData(entries: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }

  return formData;
}

describe("task form state", () => {
  it("returns a Chinese title error instead of throwing", () => {
    const result = parseCreateTaskForm(
      makeFormData({
        title: " ",
        type: "coursework",
        dueAt: "",
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.state.message).toBe("请检查任务信息");
      expect(result.state.errors.title).toEqual(["请填写任务标题"]);
    }
  });

  it("returns a Chinese due date error for invalid datetime input", () => {
    const result = parseCreateTaskForm(
      makeFormData({
        title: "地质工程作业",
        type: "coursework",
        dueAt: "not-a-date",
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.state.errors.dueAt).toEqual(["截止时间格式不正确"]);
    }
  });

  it("keeps submitted values when validation fails", () => {
    const result = parseUpdateTaskForm(
      makeFormData({
        title: "",
        type: "drawing",
        status: "doing",
        source: "成图课",
        dueAt: "2026-05-30T08:00",
        notes: "继续画图",
        nextAction: "画轴网",
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.state.values.type).toBe("drawing");
      expect(result.state.values.status).toBe("doing");
      expect(result.state.values.dueAt).toBe("2026-05-30T08:00");
    }
  });
});
