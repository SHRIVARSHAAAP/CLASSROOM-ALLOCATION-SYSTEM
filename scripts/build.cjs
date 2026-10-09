const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const build = spawnSync(process.execPath, [require.resolve('next/dist/bin/next'), 'build'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status || 1);
// Next server output can retain a static-export diagnostic marker. Vercel's local
// packager interprets that marker as a failed export even for a successful server build.
const manifest = '.next/required-server-files.json';
if (fs.existsSync(manifest) && JSON.parse(fs.readFileSync(manifest, 'utf8')).config.output !== 'export') {
  fs.rmSync('.next/export-detail.json', { force: true });
}
