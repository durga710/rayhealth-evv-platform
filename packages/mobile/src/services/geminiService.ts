/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;
let aiPromise: Promise<GoogleGenAI | null> | null = null;

type GeminiEnvLike = {
  VITE_GEMINI_API_KEY?: string;
  GEMINI_API_KEY?: string;
};

export function resolveGeminiApiKey(env: GeminiEnvLike): string | null {
  const preferred = env.VITE_GEMINI_API_KEY?.trim();
  if (preferred) {
    return preferred;
  }

  const legacy = env.GEMINI_API_KEY?.trim();
  return legacy && legacy.length > 0 ? legacy : null;
}

export async function getGemini(): Promise<GoogleGenAI | null> {
  if (ai) {
    return ai;
  }

  if (aiPromise !== null) {
    return await aiPromise;
  }

  aiPromise = (async () => {
    const apiKey = resolveGeminiApiKey((import.meta as ImportMeta & { env?: GeminiEnvLike }).env ?? {});
    if (!apiKey) {
      console.warn("VITE_GEMINI_API_KEY is not set. AI features will be disabled.");
      return null;
    }

    const { GoogleGenAI } = await import("@google/genai");
    ai = new GoogleGenAI({ apiKey });
    return ai;
  })();

  return await aiPromise;
}

/**
 * Caregiver assistant. Was previously a direct Gemini integration that
 * fell back to "I'm currently resting" without an API key — and Gemini
 * isn't BAA-eligible, so it could not be safely used with PHI anyway.
 *
 * Now routes through the RayHealth platform's `/api/admin-assistant/chat`
 * endpoint, which runs on AWS Bedrock under the AWS Business Associate
 * Addendum (verified active 2026-05-08 in AWS Artifact). The endpoint
 * is agency-scoped — even though "admin-assistant" is in the name,
 * calling it as a caregiver simply produces caregiver-relevant
 * responses tool-bounded to the caller's agency. Long-term we'll spin
 * off /api/mobile-assistant/chat with a caregiver-tuned system prompt.
 *
 * The legacy `getGemini()` / `resolveGeminiApiKey()` helpers above are
 * retained so the existing gemini-service.test.ts tests keep passing.
 */
import { getRayHealthApiBaseUrl } from './rayhealth-contract';
import { getStoredSession } from './rayhealth-session';

export const rayAssistantService = {
  chat: async (message: string, _context?: unknown): Promise<string> => {
    const session = getStoredSession();
    if (!session?.accessToken) {
      return 'Please sign in again to use the assistant.';
    }
    try {
      const r = await fetch(`${getRayHealthApiBaseUrl()}/admin-assistant/chat`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: message }],
        }),
        credentials: 'omit',
      });
      const text = await r.text();
      if (!r.ok) {
        if (r.status === 503) {
          return 'The assistant is offline right now. Please try again in a few minutes.';
        }
        return `Sorry, I couldn't process that just now (${r.status}).`;
      }
      try {
        const parsed = JSON.parse(text) as { message?: string };
        return parsed.message || "I'm sorry, I couldn't process that request.";
      } catch {
        return "I'm sorry, I couldn't process that request.";
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('rayAssistantService chat failed:', error);
      return 'I encountered an error while trying to help. Please try again soon.';
    }
  },
};
