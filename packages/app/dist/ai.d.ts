import { type LanguageModel } from 'ai';
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
export declare const BEDROCK_MODEL_ID: string;
export declare const aiModel: LanguageModel;
/**
 * Bedrock is reachable when a Bedrock API key (bearer token) or SigV4
 * credentials are present. The provider auto-detects AWS_BEARER_TOKEN_BEDROCK.
 */
export declare function isBedrockConfigured(): boolean;
/** True when ANY AI provider is usable (Bedrock preferred, Gemini fallback). */
export declare function isAIConfigured(): boolean;
export declare class AINotConfiguredError extends Error {
    constructor();
}
export interface AskAIInput {
    /** The user's question / instruction. */
    prompt: string;
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
export declare function askAI(input: AskAIInput): Promise<AskAIOutput>;
//# sourceMappingURL=ai.d.ts.map