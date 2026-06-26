import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveGeminiApiKey } from '../geminiService.ts';

test('resolveGeminiApiKey prefers the Vite public Gemini key', () => {
  assert.equal(
    resolveGeminiApiKey({
      VITE_GEMINI_API_KEY: 'public-vite-key',
      GEMINI_API_KEY: 'server-only-key',
    }),
    'public-vite-key',
  );
});

test('resolveGeminiApiKey falls back to the legacy gemini key when needed', () => {
  assert.equal(
    resolveGeminiApiKey({
      GEMINI_API_KEY: 'legacy-key',
    }),
    'legacy-key',
  );
});

test('resolveGeminiApiKey returns null when no key is configured', () => {
  assert.equal(resolveGeminiApiKey({}), null);
});
