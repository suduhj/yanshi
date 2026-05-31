# Review History and AI Recap Design

## Goal

Build the first second-stage loop for Yanshi: record a small set of task handling events, show a compact daily recap, and let the user explicitly generate an AI recap from that history.

## Product Scope

This stage is named `第二阶段：复盘历史与 AI 回顾`.

The first milestone is `2.1 今日小结闭环`.

It includes:

- Recording task history events for key user actions.
- Showing a compact `今日小结` area on the home page.
- Showing recent task history near a task, preferably on the edit page first.
- Adding a `生成 AI 回顾` button in `今日小结`.
- Falling back to a local rule-based recap when DeepSeek is not configured.

It does not include:

- Background Agent behavior.
- Web Push or system-level scheduled reminders.
- AI directly creating, completing, deleting, or editing tasks.
- A full analytics dashboard.
- Data export, import, backup, or restore.

## Event Model

Add a `TaskEvent` table with the following fields:

- `id`: string id.
- `taskId`: nullable relation to `Task`.
- `taskTitle`: title snapshot at the time of the event.
- `type`: string enum-like value.
- `summary`: short human-readable Chinese description.
- `metadata`: optional JSON text for small structured details.
- `chinaDateKey`: China date key in `YYYY-MM-DD`.
- `createdAt`: event timestamp.

The first event types are:

- `task_completed`
- `daily_completed`
- `progress_completed`
- `next_action_updated`
- `due_postponed`
- `morning_confirmed_done`
- `marked_unfinished_today`

Events keep a title snapshot so history remains understandable if a task title changes or a task is deleted later.

## User Experience

The home page gets a compact `今日小结` section near the reminder area.

It shows:

- Completed tasks today.
- Progress recorded today.
- Tasks postponed or moved into today's plan today.
- Pending confirmation count for today.

Empty state:

- If there are no events, show a short neutral line such as `今天还没有留下复盘记录。`

AI recap:

- The section contains a `生成 AI 回顾` button.
- Clicking the button uses today's events plus current visible task context to generate a short recap.
- The recap is text only and never mutates tasks.
- If DeepSeek is not configured or fails, the app shows a local recap built from event groups.

Task history:

- The first implementation shows recent events on the task edit page.
- This avoids widening the already dense home task card.
- A later milestone can add a collapsible timeline to task cards.

## AI Behavior

AI input should be concise and local:

- Today's event summaries.
- Current pending confirmation count.
- Current today-must-do count.
- Current planned-today count.
- Current long-running tasks without a next action.

AI output should be:

- Chinese.
- Warm and practical.
- No longer than a few short paragraphs.
- Focused on what happened today and what to do next.

If DeepSeek is unavailable:

- The app returns a deterministic local recap.
- Normal task handling remains available.

## Architecture

Keep the same local-first Next.js pattern:

- `src/lib/tasks/events.ts`: event types, event writing helpers, recap queries.
- `src/lib/tasks/recap.ts`: local recap grouping and AI prompt/result handling.
- `src/lib/ai/deepseek.ts`: existing low-level DeepSeek call remains the only external AI gateway.
- Server Actions call event helpers after successful task mutations.
- Home page reads today events and renders `今日小结`.

No background process is introduced.

## Error Handling

- Event recording happens after the main task mutation succeeds.
- If event recording fails, the action returns a clear failure rather than silently pretending history was saved.
- AI recap failures show a concise message and a local recap fallback.
- Invalid or missing AI output does not change any task data.

## Testing

Coverage should include:

- Event writing stores China date keys correctly.
- Each supported task action records the expected event.
- Today recap groups events correctly.
- AI recap uses DeepSeek when configured.
- AI recap falls back locally when DeepSeek is missing or fails.
- The home page content keeps the `生成 AI 回顾` entry point.

## Rollout

Implementation should be incremental:

1. Add event model and migration.
2. Add event service tests and helpers.
3. Wire events into existing task actions.
4. Add home `今日小结`.
5. Add AI recap action and fallback.
6. Add recent task history on edit page.
7. Update docs and development log.
