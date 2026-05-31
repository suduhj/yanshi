import { afterEach, describe, expect, it, vi } from "vitest";

import { createDeepSeekCompletion } from "./deepseek";

const originalEnv = { ...process.env };

describe("createDeepSeekCompletion", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("returns a configuration error when the API key is missing", async () => {
    delete process.env.DEEPSEEK_API_KEY;

    const result = await createDeepSeekCompletion({
      messages: [{ content: "请解析任务", role: "user" }],
    });

    expect(result).toEqual({
      ok: false,
      reason: "请先配置 DEEPSEEK_API_KEY",
    });
  });

  it("sends a JSON chat completion request and returns assistant content", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    delete process.env.DEEPSEEK_BASE_URL;
    delete process.env.DEEPSEEK_MODEL;
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: "{\"title\":\"成图作业\"}" } }],
      }),
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createDeepSeekCompletion({
      messages: [{ content: "请解析任务，并只返回 JSON", role: "user" }],
    });

    expect(result).toEqual({
      content: "{\"title\":\"成图作业\"}",
      ok: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        }),
        method: "POST",
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      model: "deepseek-v4-flash",
      response_format: { type: "json_object" },
    });
  });

  it("can send a plain text chat completion request", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: "今天完成了复习。" } }],
      }),
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createDeepSeekCompletion({
      messages: [{ content: "请生成今日回顾", role: "user" }],
      responseFormat: "text",
    });

    expect(result).toEqual({
      content: "今天完成了复习。",
      ok: true,
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("response_format");
  });

  it("returns a concise error when DeepSeek responds with a non-2xx status", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: vi.fn().mockResolvedValue("rate limited"),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createDeepSeekCompletion({
      messages: [{ content: "请解析任务", role: "user" }],
    });

    expect(result).toEqual({
      ok: false,
      reason: "DeepSeek 请求失败：429，请稍后重试或检查配置",
    });
  });
});
