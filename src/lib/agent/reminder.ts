export type ReminderCheckResult = {
  checkedAt: Date;
  reminders: [];
  status: "idle";
};

export async function runReminderCheck(): Promise<ReminderCheckResult> {
  return {
    checkedAt: new Date(),
    reminders: [],
    status: "idle",
  };
}
