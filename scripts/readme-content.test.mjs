import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("README content", () => {
  it("documents first-stage features and local AI configuration", async () => {
    const readme = await readFile("README.md", "utf8");

    expect(readme).toContain("## 第一阶段能力");
    expect(readme).toContain("晨间回砚");
    expect(readme).toContain("待确认");
    expect(readme).toContain("DeepSeek");
    expect(readme).toContain("DEEPSEEK_API_KEY");
    expect(readme).toContain("Next.js 开发工具");
  });
});
