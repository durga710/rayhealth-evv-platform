import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcDirectory = resolve(process.cwd(), 'src');
const colorLiteralPattern = /#[\da-f]{3,4}\b|#[\da-f]{6}(?:[\da-f]{2})?\b/gi;

function tokenHex(css: string, token: string): string {
  const value = css.match(new RegExp(`${token}:\\s*(#[\\da-f]{6})`, 'i'))?.[1];
  if (!value) throw new Error(`Missing hex value for ${token}`);
  return value;
}

function relativeLuminance(hex: string): number {
  const channels = hex.match(/[\da-f]{2}/gi)?.map((channel) => parseInt(channel, 16) / 255) ?? [];
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

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

  it('keeps white labels WCAG AA-safe on every bold action color', () => {
    const css = readFileSync(join(srcDirectory, 'index.css'), 'utf8');
    const onBrand = tokenHex(css, '--color-on-brand');
    const actionTokens = [
      '--color-primary',
      '--color-primary-dark',
      '--color-accent',
      '--color-accent-dark',
      '--color-success',
      '--color-danger',
      '--color-warning',
    ];

    for (const token of actionTokens) {
      expect(contrastRatio(onBrand, tokenHex(css, token)), token).toBeGreaterThanOrEqual(4.5);
    }
  });
});
