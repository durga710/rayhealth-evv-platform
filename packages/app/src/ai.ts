import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { generateText, type LanguageModel } from 'ai';
import {
  askGemini,
  isGeminiConfigured,
  type GeminiModel,
} from './services/gemini-client.js';

const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

/**
 * Active Claude model on Bedrock.
 *
 * Default is the Claude Haiku 4.5 cross-region inference profile. AWS retired
 * the previous default (`anthropic.claude-3-5-haiku-20241022-v1:0`) as legacy,
 * so that id now returns a ValidationException — which is why onboarding and
 * the admin assistant were silently failing in prod. Override via
 * BEDROCK_MODEL_ID; the Pro copilot tier can override separately via
 * BEDROCK_MODEL_ID_PRO.
 */
export const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

export const aiModel: LanguageModel = bedrock(BEDROCK_MODEL_ID);

/**
 * Bedrock is reachable when a Bedrock API key (bearer token) or SigV4
 * credentials are present. The provider auto-detects AWS_BEARER_TOKEN_BEDROCK.
 */
export function isBedrockConfigured(): boolean {
  return Boolean(
    process.env.AWS_BEARER_TOKEN_BEDROCK ||
      (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
  );
}

/** True when ANY AI provider is usable (Bedrock preferred, Gemini fallback). */
export function isAIConfigured(): boolean {
  return isBedrockConfigured() || isGeminiConfigured();
}

export class AINotConfiguredError extends Error {
  constructor() {
    super(
      'No AI provider configured (set AWS_BEARER_TOKEN_BEDROCK or GOOGLE_AI_API_KEY).',
    );
    this.name = 'AINotConfiguredError';
  }
}

export interface AskAIInput {
  /** The user's question / instruction. Used for single-turn calls. */
  prompt?: string;
  /**
   * Multi-turn conversation history (oldest first, last entry must be the
   * current user turn). When provided, takes precedence over `prompt` so
   * chat surfaces (e.g. the marketing support chat) keep context. Either
   * `prompt` or `messages` must be set.
   */
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** System prompt anchoring the assistant's role + guardrails. */
  systemInstruction: string;
  /** 'pro' routes to a stronger model when one is configured. */
  tier?: 'starter' | 'pro';
  /** Response length cap. Defaults to 800 tokens. */
  maxOutputTokens?: number;
}

export interface AskAIOutput {
  text: string;
  usageTokens: number;
  model: string;
  provider: 'bedrock' | 'gemini';
}

/**
 * Provider-agnostic single-turn ask used by the Copilot.
 *
 * Bedrock (Claude) is the primary provider; Gemini is retained as a fallback so
 * a missing Bedrock key or a transient Bedrock outage degrades gracefully
 * instead of 500ing the Copilot. Returns the same { text, usageTokens, model }
 * contract the route already relied on, plus which provider answered.
 */
export async function askAI(input: AskAIInput): Promise<AskAIOutput> {
  const maxOutputTokens = input.maxOutputTokens ?? 800;

  if (isBedrockConfigured()) {
    const modelId =
      input.tier === 'pro' && process.env.BEDROCK_MODEL_ID_PRO
        ? process.env.BEDROCK_MODEL_ID_PRO
        : BEDROCK_MODEL_ID;
    const model = modelId === BEDROCK_MODEL_ID ? aiModel : bedrock(modelId);

    const result = await generateText({
      model,
      system: input.systemInstruction,
      // Multi-turn history when provided, else the single prompt.
      ...(input.messages ? { messages: input.messages } : { prompt: input.prompt ?? '' }),
      maxOutputTokens,
      temperature: 0.4,
    });

    const usage = result.usage as
      | { totalTokens?: number; inputTokens?: number; outputTokens?: number }
      | undefined;
    const usageTokens =
      usage?.totalTokens ?? (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);

    return { text: result.text, usageTokens, model: modelId, provider: 'bedrock' };
  }

  if (isGeminiConfigured()) {
    const geminiModel: GeminiModel =
      input.tier === 'pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    // Gemini fallback is single-prompt; flatten any multi-turn history into a
    // labelled transcript so context is preserved across the provider switch.
    const geminiPrompt = input.messages
      ? input.messages
          .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n\n')
      : (input.prompt ?? '');
    const r = await askGemini({
      prompt: geminiPrompt,
      systemInstruction: input.systemInstruction,
      model: geminiModel,
      maxOutputTokens,
    });
    return {
      text: r.text,
      usageTokens: r.usageTokens,
      model: r.model,
      provider: 'gemini',
    };
  }

  throw new AINotConfiguredError();
}
