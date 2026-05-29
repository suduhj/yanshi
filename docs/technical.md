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
```

Prisma 会把该路径解析到 `prisma/data/dev.db`。数据库文件不提交到 Git。

任务截止时间统一按中国时间处理。表单的 `datetime-local` 值会被解释为 `Asia/Shanghai` 本地时间，再保存为 UTC DateTime；展示、筛选和排序都通过同一套中国时间工具函数处理。

迁移 `20260529044000_repair_legacy_china_time_offset` 会把旧版本保存过的 `dueAt` 统一减去 8 小时，用于修复此前 `datetime-local` 被当作 UTC 导致的显示偏移。

当前 Windows 中文路径下，Prisma 迁移可能需要先确保 `prisma/data/dev.db` 存在，或通过临时 ASCII 盘符运行：

```bat
subst P: "D:\Develop\Vscode\Visual project\新建文件夹"
```

然后在 `P:\` 执行 Prisma 命令。

## Docker

中文目录名下 Docker Compose 可能无法自动推导项目名，建议使用显式项目名：

```bash
docker compose -p ai-task-butler up --build
```

如果首次构建无法拉取 `node:24-alpine`，先确认 Docker Hub 网络可用。

## 架构边界

- `src/app`：页面与 Server Actions 入口。
- `src/lib/tasks`：任务领域规则、服务层、表单动作。
- `src/lib/prisma.ts`：Prisma Client 单例。
- `src/lib/ai/deepseek.ts`：DeepSeek API 预留入口。
- `src/lib/agent/reminder.ts`：定时提醒 / Agent 预留入口。
