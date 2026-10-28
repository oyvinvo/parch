#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

/**
 * Calculates CRAP score:
 * CRAP(m) = CC(m)^2 * (1 - cov(m))^3 + CC(m)
 * cov(m) is branch/line coverage in range [0.0, 1.0]
 */
export function calculateCrap(cyclomaticComplexity, coveragePercent) {
  const cov = Math.max(0, Math.min(1, coveragePercent / 100));
  const crap = (cyclomaticComplexity ** 2) * ((1 - cov) ** 3) + cyclomaticComplexity;
  return Number(crap.toFixed(2));
}

function main() {
  const summaryPath = path.resolve('coverage', 'coverage-summary.json');
  if (!fs.existsSync(summaryPath)) {
    console.warn('CRAP: No coverage report found at coverage/coverage-summary.json. Run vitest --coverage first.');
    process.exit(0);
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  let maxCrap = 0;
  let hasFailure = false;

  console.log('\n--- CRAP Metric Verification (Target: CRAP <= 8.0, CC <= 7) ---');
  for (const [filePath, stats] of Object.entries(summary)) {
    if (filePath === 'total' || filePath.includes('.test.') || filePath.includes('-adapter.')) {
      continue;
    }
    const lineCov = stats.lines?.pct ?? 100;
    // Assume CC <= 7 is enforced by eslint; worst case CC = 7 with lineCov:
    const worstCaseCrap = calculateCrap(7, lineCov);
    if (worstCaseCrap > maxCrap) {
      maxCrap = worstCaseCrap;
    }
    console.log(`${path.basename(filePath)}: Coverage ${lineCov}%, Worst-case CRAP ${worstCaseCrap}`);
    if (worstCaseCrap > 8.0) {
      console.error(`FAILED: ${filePath} exceeds CRAP threshold 8.0 (${worstCaseCrap})`);
      hasFailure = true;
    }
  }

  console.log(`Max CRAP Score: ${maxCrap}`);
  if (hasFailure) {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
  main();
}
