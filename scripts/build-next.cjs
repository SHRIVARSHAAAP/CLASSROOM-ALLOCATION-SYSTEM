const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const result = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build"], { stdio: "inherit", env: process.env });
if (result.error) { console.error(result.error.message); process.exit(1); }
if (result.status !== 0) process.exit(result.status || 1);
const manifest = JSON.parse(fs.readFileSync(path.join(".next", "required-server-files.json"), "utf8"));
// Server builds must not be mistaken for a standalone static export by Vercel.
// Leave genuine output: 'export' metadata intact. Never run after a failed build.
if (manifest.config.output !== "export") {
  fs.rmSync(path.join(".next", "export-detail.json"), { force: true });
}
