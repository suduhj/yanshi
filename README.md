# 砚时

砚时：于书砚之间，理清每日之事。

本项目是本地优先的大学生任务中枢，用于管理课程作业、成图任务、考试复习、学校活动、团支书任务、竞赛任务和生活杂事。

## 第一阶段能力

- 任务工作台：创建、筛选、完整编辑、删除和状态处理。
- 今日处理流：今日必须完成、今日要做、每日任务、持续推进、其他任务和已完成任务。
- 温和复盘：过截止时间的未完成任务先进入“待确认”，通过“晨间回砚”确认完成、加入今日、推迟或拆成下一步。
- 卡片操作：普通任务可完成，每日任务可完成今日，持续推进任务可记录今日推进、更新下一步或标记整个任务完成。
- AI 辅助：DeepSeek 只解析单个任务草稿并回填表单，用户确认后才创建任务。
- 本地提醒：页面内提醒建议和浏览器通知只在页面打开期间工作，不接入后台常驻 Agent、Web Push 或系统级定时能力。

## 本地开发

如果系统没有全局 `pnpm`，使用 `corepack pnpm` 运行同样命令。

```powershell
Copy-Item .env.example .env
corepack pnpm install
corepack pnpm prisma migrate dev
corepack pnpm dev
```

默认访问 `http://localhost:3100`。本项目固定使用 3100，避免占用其他本地项目的 3000 端口。

## 环境变量

首次运行前复制 `.env.example` 为 `.env`，至少保留 SQLite 地址：

```env
DATABASE_URL="file:./data/dev.db"
DEEPSEEK_API_KEY=""
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-v4-flash"
```

`DEEPSEEK_API_KEY` 为空时，自然语言解析会提示先配置密钥，普通任务管理不受影响。配置密钥后，“自然语言描述”里的“解析填入”会调用 DeepSeek 生成任务草稿。

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

SQLite 数据通过 `./prisma/data:/app/prisma/data` 挂载到本地。这个目录里的数据库文件不提交到 Git。

本地生成物如 `.next/`、`node_modules/`、`.pnpm-store/`、`tsconfig.tsbuildinfo` 已在 `.gitignore` 中忽略，不需要提交。

## 开发提示

开发模式下页面左下角可能出现 Next.js 开发工具圆形按钮，点开会显示 Route、Bundler、Route Info 等调试信息。这不是砚时自己的功能，生产构建中不会作为应用界面出现。

## 文档

- `GPT.md`：AI 协作说明和标准文件索引
- `docs/requirements.md`：需求范围
- `docs/technical.md`：技术规范
- `docs/design.md`：设计规范
- `docs/implementation-steps.md`：执行步骤
- `开发日志/`：每日开发日志
