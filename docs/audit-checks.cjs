// Original audit entry point, now checking corrected behavior instead of
// expecting the old vulnerabilities to remain present.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const result = spawnSync(process.execPath, ['--test', path.resolve(__dirname, '../backend/test/critical-fixes.test.cjs')], { stdio: 'inherit' });
if (result.error) console.error(result.error);
process.exitCode = result.status ?? 1;
