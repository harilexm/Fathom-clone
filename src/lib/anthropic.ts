/**
 * Anthropic client helper for fallback LLM operations.
 * Privileged API keys remain strictly server-side.
 */

export function getAnthropicApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error("ANTHROPIC_API_KEY is not configured on the server");
  }
  return apiKey.trim();
}

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim());
}

export function getAnthropicChatModel(): string {
  return (
    process.env.ANTHROPIC_CHAT_MODEL?.trim() ||
    process.env.ANTHROPIC_ANALYSIS_MODEL?.trim() ||
    "claude-sonnet-5"
  );
}
