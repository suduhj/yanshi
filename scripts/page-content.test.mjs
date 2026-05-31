import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("home page content", () => {
  it("uses consistent first-stage wording for the must-do-today summary", async () => {
    const page = await readFile("src/app/page.tsx", "utf8");

    expect(page).toContain('label="今日必须完成"');
    expect(page).not.toContain('label="今天截止"');
  });

  it("exposes the daily recap entry point", async () => {
    const page = await readFile("src/app/page.tsx", "utf8");

    expect(page).toContain("今日小结");
    expect(page).toContain("DailyRecapActionPanel");
  });
});
