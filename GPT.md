# AI 协作说明

## 项目

大学生 AI 任务管家，本地优先的 Next.js Web App。

## 标准文件

- 需求范围：`docs/requirements.md`
- 技术规范：`docs/technical.md`
- 设计规范：`docs/design.md`
- 执行步骤：`docs/implementation-steps.md`
- 每日开发日志：`开发日志/YYYY-MM-DD.md`

## 工作要求

- 不要一次性引入复杂 Agent，优先小步稳定推进。
- 每次完成任务后运行相关验证。
- 每次完成任务后更新当天开发日志。
- 如果开发需求、技术规范、设计规范或执行步骤有变化，更新 `docs` 下对应文件。
- 如果新增标准文件、路径或协作规则，更新本文件。
- DeepSeek 和 Agent 能力先通过清晰模块边界预留，后续按里程碑接入。
- 中文目录下执行 Docker Compose 时使用 `docker compose -p ai-task-butler ...`。
