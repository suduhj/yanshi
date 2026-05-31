# 砚时

砚时：于书砚之间，理清每日之事。

本项目是本地优先的大学生任务中枢，用于管理课程作业、成图任务、考试复习、学校活动、团支书任务、竞赛任务和生活杂事。

## 本地开发

如果系统没有全局 `pnpm`，使用 `corepack pnpm` 运行同样命令。

```bash
corepack pnpm install
corepack pnpm prisma migrate dev
corepack pnpm dev
```

默认访问 `http://localhost:3100`。本项目固定使用 3100，避免占用其他本地项目的 3000 端口。

## 常用命令

```bash
corepack pnpm test
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
corepack pnpm log:today
```

## Docker

中文目录名下建议显式指定 Compose 项目名：

```bash
docker compose -p yanshi up --build
```

## 文档

- `GPT.md`：AI 协作说明和标准文件索引
- `docs/requirements.md`：需求范围
- `docs/technical.md`：技术规范
- `docs/design.md`：设计规范
- `docs/implementation-steps.md`：执行步骤
- `开发日志/`：每日开发日志
