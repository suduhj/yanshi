import { describe, expect, it } from "vitest";

import { getChinaDateKey } from "./log-today.mjs";

describe("log-today script", () => {
  it("uses China time when choosing the daily log date", () => {
    expect(getChinaDateKey(new Date("2026-05-30T16:30:00.000Z"))).toBe("2026-05-31");
  });
});
