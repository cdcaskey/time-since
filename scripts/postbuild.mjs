import { cpSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

cpSync('server/migrations', 'server/dist/server/migrations', { recursive: true });

// Mantine's own stylesheet plus @mantine/notifications' stylesheet are two
// separate imports (see CLAUDE.md invariants) — missing either compiles fine
// and fails only at runtime, silently, with no undo toast ever appearing.
// Assert both landed in the built CSS so that failure mode is a build error.
const cssDir = 'dist/assets';
const cssFiles = readdirSync(cssDir).filter((f) => f.endsWith('.css'));
const css = cssFiles.map((f) => readFileSync(path.join(cssDir, f), 'utf8')).join('\n');

if (!css.includes('--mantine-color-body')) {
  console.error('[postbuild] built CSS is missing Mantine core styles (--mantine-color-body)');
  process.exit(1);
}
if (!css.includes('notification')) {
  console.error('[postbuild] built CSS is missing @mantine/notifications styles');
  process.exit(1);
}
