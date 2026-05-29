import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const logDir = path.join(root, "开发日志");
const today = new Date().toISOString().slice(0, 10);
const logPath = path.join(logDir, `${today}.md`);

const sections = [
  "## 完成事项",
  "## 待办事项",
  "## 文档更新",
  "## 备注",
];

await mkdir(logDir, { recursive: true });

if (!existsSync(logPath)) {
  await writeFile(
    logPath,
    `# ${today} 开发日志\n\n${sections.map((section) => `${section}\n- `).join("\n\n")}\n`,
    "utf8",
  );
  console.log(`created ${path.relative(root, logPath)}`);
  process.exit(0);
}

let content = await readFile(logPath, "utf8");

for (const section of sections) {
  if (!content.includes(section)) {
    content += `\n\n${section}\n- \n`;
  }
}

await writeFile(logPath, content, "utf8");
console.log(`updated ${path.relative(root, logPath)}`);
