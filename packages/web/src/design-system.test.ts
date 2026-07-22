import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcDirectory = resolve(process.cwd(), 'src');
const colorLiteralPattern = /#[\da-f]{3,4}\b|#[\da-f]{6}(?:[\da-f]{2})?\b/gi;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(path);
    }

    if (!entry.name.endsWith('.tsx') || entry.name.includes('.test.')) {
      return [];
    }

    return [path];
  });
}

describe('RayHealth visual system', () => {
  it('defines one bold, accessible brand contract for every surface', () => {
    const css = readFileSync(join(srcDirectory, 'index.css'), 'utf8');

    expect(css).toContain('--color-on-brand:');
    expect(css).toContain('--color-text-on-dark:');
    expect(css).toContain('--color-surface-elevated:');
    expect(css).toContain('--gradient-brand:');
    expect(css).toContain('--shadow-card-hover:');
  });

  it('keeps page and component colors connected to shared tokens', () => {
    const violations = sourceFiles(srcDirectory).flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      const colors = source.match(colorLiteralPattern) ?? [];

      return colors.length === 0
        ? []
        : [`${relative(srcDirectory, path)}: ${[...new Set(colors.map((color) => color.toLowerCase()))].join(', ')}`];
    });

    expect(violations).toEqual([]);
  });
});
