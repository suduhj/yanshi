export type DeepSeekMessage = {
  content: string;
  role: "system" | "user" | "assistant";
};

export type DeepSeekCompletionRequest = {
  messages: DeepSeekMessage[];
  model?: string;
};

export async function createDeepSeekCompletion(request: DeepSeekCompletionRequest) {
  void request;

  if (!process.env.DEEPSEEK_API_KEY) {
    return {
      ok: false as const,
      reason: "DEEPSEEK_API_KEY is not configured",
    };
  }

  return {
    ok: false as const,
    reason: "DeepSeek integration is reserved for a later milestone",
  };
}
