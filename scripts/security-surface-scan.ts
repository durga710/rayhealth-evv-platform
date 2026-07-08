import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['packages/web/src', 'packages/mobile/src'];
const bannedPatterns = [
  { pattern: /rayhealth_token/g, message: 'browser JWT storage key must not be present' },
  // Match both `rayhealth_foo` and `rayhealth.foo` separator styles so an
  // attacker (or careless contributor) can't dodge the rule by swapping
  // the underscore for a dot.
  { pattern: /localStorage\.setItem\(['"]rayhealth[._]/g, message: 'auth state must not be persisted to localStorage' },
  { pattern: /sessionStorage\.setItem\(['"]rayhealth[._]/g, message: 'auth state must not be persisted to sessionStorage' },
  { pattern: /Authorization['"]?\s*:\s*`Bearer \$\{token\}`/g, message: 'web client must not attach browser bearer tokens' }
];

function filesUnder(relativeDir: string): string[] {
  const absoluteDir = join(ROOT, relativeDir);
  return readdirSync(absoluteDir).flatMap((name) => {
    const path = join(absoluteDir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) return filesUnder(path.slice(ROOT.length + 1));
    if (!/\.(ts|tsx)$/.test(path)) return [];
    if (/\.(test|spec)\.(ts|tsx)$/.test(path)) return [];
    return [path];
  });
}

const failures: string[] = [];
const sourceFiles = SCAN_DIRS.flatMap(filesUnder);

function repoPath(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/');
}

for (const file of sourceFiles) {
  const source = readFileSync(file, 'utf8');
  for (const { pattern, message } of bannedPatterns) {
    if (pattern.test(source)) {
      failures.push(`${repoPath(file)}: ${message}`);
    }
    pattern.lastIndex = 0;
  }
}

const webMainPath = join(ROOT, 'packages/web/src/main.tsx');
const webMainSource = readFileSync(webMainPath, 'utf8');
const analyticsImportFiles = sourceFiles.filter((file) =>
  readFileSync(file, 'utf8').includes('@vercel/analytics')
);

for (const file of analyticsImportFiles) {
  if (file !== webMainPath) {
    failures.push(`${repoPath(file)}: Vercel Analytics must stay centralized in main.tsx`);
  }
}

if (webMainSource.includes('@vercel/analytics/react')) {
  const compactMain = webMainSource.replace(/\s+/g, ' ');
  const importsPrivacyGate = webMainSource.includes(
    "import { dropAuthenticatedEvents } from './lib/analytics.js';"
  );
  const guardedAnalyticsMount =
    /<Analytics\b[^>]*\bbeforeSend=\{dropAuthenticatedEvents\}[^>]*\/>/.test(compactMain);

  if (!importsPrivacyGate) {
    failures.push('packages/web/src/main.tsx: Analytics mount must import dropAuthenticatedEvents');
  }

  if (!guardedAnalyticsMount) {
    failures.push(
      'packages/web/src/main.tsx: Analytics mount must use beforeSend={dropAuthenticatedEvents}'
    );
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Security surface scan passed');
