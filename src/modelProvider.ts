import { createAnthropic } from '@ai-sdk/anthropic';

export function createModel() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  return createAnthropic({ apiKey })('claude-3-5-sonnet-20241022');
}