// CLI временно устанавливается в кэш npm; зависимости приложения не меняются.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const version = require("remotion/package.json").version;
const root = path.resolve(import.meta.dirname, "..");
const chrome = process.env.REMOTION_BROWSER_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync(path.join(root, "public/video-lab"), { recursive: true });
const variants = ["cartoon", "board", "notebook", "motion"];
const selected = process.argv.slice(2);
if (selected.some((variant) => !variants.includes(variant))) throw new Error("Неизвестный вариант видео");
for (const style of selected.length ? selected : variants) {
  execFileSync("npm", ["exec", "--yes", `--package=@remotion/cli@${version}`, "--", "remotion", "render", "src/videos/lab/remotion-root.tsx", style, `public/video-lab/${style}.mp4`, "--codec=h264", "--crf=25", "--concurrency=2", "--bundle-cache=false", ...(existsSync(chrome) ? [`--browser-executable=${chrome}`] : [])], { cwd: root, stdio: "inherit" });
  console.log(`Готово: ${style}.mp4`);
}
