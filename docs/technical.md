# 技术规范

## 技术栈

- Next.js + React + TypeScript
- Tailwind CSS
- SQLite
- Prisma ORM
- Vitest
- Docker / Docker Compose
- Git

## 本地运行

如果系统没有全局 `pnpm` 命令，可以使用等价命令 `corepack pnpm`。

```bash
corepack pnpm install
corepack pnpm prisma migrate dev
corepack pnpm dev
```

生产构建在当前 Windows 环境使用 webpack：

```bash
corepack pnpm build
```

`build` 脚本固定为 `next build --webpack`，用于规避 Windows + Turbopack 在清理 `.next/export/_next` 时偶发的 `EBUSY` 文件锁问题。

## 数据库

SQLite 连接地址为：

```env
DATABASE_URL="file:./data/dev.db"
DEEPSEEK_API_KEY=""
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-v4-flash"
```

Prisma 会把该路径解析到 `prisma/data/dev.db`。数据库文件不提交到 Git。

任务截止时间统一按中国时间处理。表单的 `datetime-local` 值会被解释为 `Asia/Shanghai` 本地时间，再保存为 UTC DateTime；展示、筛选和排序都通过同一套中国时间工具函数处理。

迁移 `20260529044000_repair_legacy_china_time_offset` 会把旧版本保存过的 `dueAt` 统一减去 8 小时，用于修复此前 `datetime-local` 被当作 UTC 导致的显示偏移。

迁移 `20260529112306_add_daily_and_today_planning` 增加 `isPlannedToday`、`isDaily`、`dailyCompletedOn` 字段，用于今日计划和每日任务。

每日任务的当天完成状态使用中国日期键 `YYYY-MM-DD` 保存到 `dailyCompletedOn`。判断当天是否完成时必须通过中国时间工具函数计算日期键，不能直接使用服务器本地时区。

“待确认”不新增数据库字段，使用领域函数按中国日期动态计算：截止日期早于今天、任务未完成、非每日任务且未加入今日计划时进入待确认。用户确认“已完成”会把任务状态改为 `done`；确认“未完成，加入今日”会把 `isPlannedToday` 设为 `true`；推迟截止时间会更新 `dueAt` 并移出今日计划。

持续推进任务的“今日推进完成”第一阶段不记录历史，不新增迁移；它只表示今天阶段性处理过，任务保持进行中并从今日计划移出。第二阶段通过 `TaskEvent` 持久化复盘历史。

迁移 `20260531150807_add_task_events` 新增 `TaskEvent` 表，用于记录关键任务处理动作。事件保存任务标题快照、事件类型、简短中文摘要、中国日期键、发生时间和可选 JSON 元数据。事件的 `taskId` 允许为空，任务删除后历史仍可保留可读摘要。

任务处理动作写入 `TaskEvent` 时必须和对应任务更新处于同一个 Prisma transaction，避免任务状态已改变但复盘历史缺失。

当前 Windows 中文路径下，Prisma 迁移可能需要先确保 `prisma/data/dev.db` 存在，或通过临时 ASCII 盘符运行：

```bat
subst P: "D:\Develop\Vscode\Visual project\砚时"
```

然后在 `P:\` 执行 Prisma 命令。

## Docker

中文目录名下 Docker Compose 可能无法自动推导项目名，建议使用显式项目名：

```bash
docker compose -p yanshi up --build
```

如果首次构建无法拉取 `node:24-alpine`，先确认 Docker Hub 网络可用。

## 架构边界

- `src/app`：页面与 Server Actions 入口。
- `src/lib/tasks`：任务领域规则、服务层、表单动作。
- `src/lib/prisma.ts`：Prisma Client 单例。
- `src/lib/ai/deepseek.ts`：DeepSeek Chat Completions 调用入口，默认使用 JSON 输出解析任务草稿。
- `src/lib/agent/reminder.ts`：本地轻量提醒入口，基于任务列表同步生成提醒建议。
- 第二阶段新增 `src/lib/tasks/events.ts` 作为任务历史事件入口，新增 `src/lib/tasks/recap.ts` 作为本地小结和 AI 回顾编排入口。

## AI 解析

DeepSeek 解析第一版只生成单个任务草稿，不直接创建任务。新增任务表单通过 `intent=parseDraft` 调用解析逻辑，成功后回填现有字段；最终保存仍通过普通创建流程和现有 Zod 校验。

DeepSeek 返回的截止时间必须是中国时间语义下的 `datetime-local` 字符串，再通过任务领域时间工具归一化；无法判断截止时间时保存为空。

## AI 回顾

第二阶段的 AI 回顾由用户在“今日小结”中点击“生成 AI 回顾”主动触发。输入只包含当天任务事件摘要和少量当前任务上下文；输出只作为文本建议展示，不直接写入任务。

如果 DeepSeek 未配置、调用失败或返回空内容，系统显示本地规则生成的小结。普通任务处理不得依赖 AI 可用性。

DeepSeek 任务草稿解析继续使用 JSON 输出；AI 回顾使用普通文本输出，不发送 JSON response format。

## 轻量提醒

提醒第一版不做后台定时、Web Push 或主动 Agent。首页加载任务后调用 `runReminderCheck(tasks)`，在本地同步生成最多 5 条提醒建议。

提醒规则必须复用任务领域的中国时间工具函数：待确认/今天截止任务提示优先处理，每日任务按 `dailyCompletedOn` 判断当天是否完成，持续推进任务缺少 `nextAction` 时提示补充下一步动作。

浏览器通知只在页面打开期间工作。服务端把中国日期键传给客户端通知控件，客户端使用 `localStorage` 的 `yanshi:notified-reminders:YYYY-MM-DD` 记录当天已通知的 reminder id，避免刷新页面重复弹同一条提醒。

提醒建议和顶部统计通过 `view`、`focusTask` 查询参数跳转到任务列表或具体任务。客户端只负责滚动和短暂高亮，不负责改变任务状态。

## 复盘统计

E1/E2 数据可视化使用 `src/lib/tasks/stats.ts` 作为纯统计模块，输入当前任务和复盘事件，输出 `/stats` 页面所需的展示模型。

近 7 天趋势按中国日期键聚合，日期窗口包含今天，并复用中国时间语义避免服务器时区差异。第一版统计完成、推进、重新安排和更新下一步等事件数量，不新增数据库表。

`/stats` 页面使用 Tailwind CSS 绘制轻量数字卡片、横向条和列表，不引入 Recharts、Chart.js 等图表库。
