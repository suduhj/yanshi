"use server";

import { listTodayTaskEvents } from "./events";
import { generateDailyAiRecap } from "./recap";

export type DailyRecapState = {
  message: string;
  source: "ai" | "local" | "";
};

export async function generateDailyRecapAction(): Promise<DailyRecapState> {
  const events = await listTodayTaskEvents();
  const recap = await generateDailyAiRecap(events);

  return {
    message: recap.text,
    source: recap.source,
  };
}
