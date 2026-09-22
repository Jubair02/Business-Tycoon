// ============================================
// Bangladesh Business Tycoon - Standalone build
// ============================================
//
// Builds the self-hosting bundle: `next build` with `output: "standalone"`, then
// the two copies Next.js deliberately leaves to you — static assets and
// `public/` are not traced into the standalone tree, so a server started from
// it would come up with no CSS and no images.
//
// This exists as a script rather than a package.json one-liner because that
// one-liner was `BUILD_STANDALONE=1 next build && cp -r ...`, which is POSIX
// and fails on cmd.exe and PowerShell with "'cp' is not recognized". Node runs
// the same everywhere, and `fs.cpSync` is `cp -r`.
//
// Not needed for Vercel — it builds and serves the app itself. See
// `docs/deploying-to-vercel.md`.

import { cpSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const standalone = join(root, '.next', 'standalone');

const build = spawnSync('npx', ['next', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, BUILD_STANDALONE: '1' },
  // Windows resolves `npx` through the shell; without this it is ENOENT.
  shell: process.platform === 'win32',
});

if (build.status !== 0) process.exit(build.status ?? 1);

if (!existsSync(standalone)) {
  console.error(
    '\n[build:standalone] next build produced no .next/standalone tree.\n' +
      'That means `output: "standalone"` did not apply — check that\n' +
      'next.config.ts still reads BUILD_STANDALONE.',
  );
  process.exit(1);
}

cpSync(join(root, '.next', 'static'), join(standalone, '.next', 'static'), { recursive: true });
cpSync(join(root, 'public'), join(standalone, 'public'), { recursive: true });

console.log('\n[build:standalone] Ready. Start it with: npm run start:standalone');
