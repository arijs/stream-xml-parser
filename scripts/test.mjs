import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const suiteDir = join(__dirname, '..', 'test', 'suite');

const files = readdirSync(suiteDir)
	.filter(f => f.endsWith('.test.js'))
	.sort()
	.map(f => join(suiteDir, f));

const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
