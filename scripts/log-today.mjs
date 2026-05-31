import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const sections = [
  "## 完成事项",
  "## 待办事项",
  "## 文档更新",
  "## 备注",
];

export function getChinaDateKey(date = new Date()) {
  const chinaDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const year = chinaDate.getUTCFullYear();
  const month = String(chinaDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(chinaDate.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export async function ensureTodayLog(root = process.cwd(), now = new Date()) {
  const logDir = path.join(root, "开发日志");
  const today = getChinaDateKey(now);
  const logPath = path.join(logDir, `${today}.md`);

  await mkdir(logDir, { recursive: true });

  if (!existsSync(logPath)) {
    await writeFile(
      logPath,
      `# ${today} 开发日志\n\n${sections.map((section) => `${section}\n- `).join("\n\n")}\n`,
      "utf8",
    );
    return { action: "created", logPath };
  }

  let content = await readFile(logPath, "utf8");

  for (const section of sections) {
    if (!content.includes(section)) {
      content += `\n\n${section}\n- \n`;
    }
  }

  await writeFile(logPath, content, "utf8");
  return { action: "updated", logPath };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = process.cwd();
  const result = await ensureTodayLog(root);
  console.log(`${result.action} ${path.relative(root, result.logPath)}`);
}
