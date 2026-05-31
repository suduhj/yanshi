export type DeepSeekMessage = {
  content: string;
  role: "system" | "user" | "assistant";
};

export type DeepSeekCompletionRequest = {
  messages: DeepSeekMessage[];
  model?: string;
  responseFormat?: "json" | "text";
};

export type DeepSeekCompletionResult =
  | {
      content: string;
      ok: true;
    }
  | {
      ok: false;
      reason: string;
    };

type DeepSeekChatResponse = {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
};

export async function createDeepSeekCompletion(request: DeepSeekCompletionRequest) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return {
      ok: false as const,
      reason: "请先配置 DEEPSEEK_API_KEY",
    };
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = request.model || process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  const body: Record<string, unknown> = {
    messages: request.messages,
    model,
    temperature: 0.2,
  };

  if (request.responseFormat !== "text") {
    body.response_format = { type: "json_object" };
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      return {
        ok: false as const,
        reason: `DeepSeek 请求失败：${response.status}，请稍后重试或检查配置`,
      };
    }

    const data = (await response.json()) as DeepSeekChatResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return {
        ok: false as const,
        reason: "DeepSeek 没有返回可解析的内容",
      };
    }

    return {
      content,
      ok: true as const,
    };
  } catch {
    return {
      ok: false as const,
      reason: "DeepSeek 请求失败，请稍后重试",
    };
  }
}
