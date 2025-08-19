import { createAnthropic, AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createXai } from "@ai-sdk/xai";
import { createTogetherAI } from "@ai-sdk/togetherai";
import { JSONValue, LanguageModel } from "ai";

export function createProvider(modelId?: string): {
  options: Record<string, Record<string, JSONValue>>;
  model: LanguageModel;
} {
  // Default to Claude 3.5 Sonnet if no model specified
  const model = modelId || "anthropic/claude-sonnet-4-20250514";

  // Parse provider and model from format: "provider/model-name"
  const [provider, ...modelParts] = model.split("/");
  const modelName = modelParts.join("/");

  if (!provider || !modelName) {
    throw new Error(
      `Invalid model format: ${model}. Expected format: "provider/model-name"`
    );
  }

  switch (provider.toLowerCase()) {
    case "anthropic":
      const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
      if (!anthropicApiKey) {
        throw new Error(
          "ANTHROPIC_API_KEY environment variable is required for Anthropic models"
        );
      }
      return {
        model: createAnthropic({ apiKey: anthropicApiKey })(modelName),
        options: {
          anthropic: {
            thinking: { type: "enabled", budgetTokens: 12000 },
          } satisfies AnthropicProviderOptions,
        },
      };

    case "openai":
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        throw new Error(
          "OPENAI_API_KEY environment variable is required for OpenAI models"
        );
      }

      return {
        model: createOpenAI({ apiKey: openaiApiKey })(modelName),
        options: {},
      };

    case "google":
      const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!googleApiKey) {
        throw new Error(
          "GOOGLE_GENERATIVE_AI_API_KEY environment variable is required for Google models"
        );
      }
      return {
        model: google(modelName),
        options: {},
      };

    case "mistral":
      const mistralApiKey = process.env.MISTRAL_API_KEY;
      if (!mistralApiKey) {
        throw new Error(
          "MISTRAL_API_KEY environment variable is required for Mistral models"
        );
      }
      return {
        model: createMistral({ apiKey: mistralApiKey })(modelName),
        options: {},
      };

    case "xai":
      const xaiApiKey = process.env.XAI_API_KEY;
      if (!xaiApiKey) {
        throw new Error(
          "XAI_API_KEY environment variable is required for xAI models"
        );
      }
      return {
        model: createXai({ apiKey: xaiApiKey })(modelName),
        options: {},
      };

    case "together":
      const togetherApiKey = process.env.TOGETHER_AI_API_KEY;
      if (!togetherApiKey) {
        throw new Error(
          "TOGETHER_AI_API_KEY environment variable is required for Together AI models"
        );
      }
      return {
        model: createTogetherAI({ apiKey: togetherApiKey })(modelName),
        options: {},
      };

    default:
      throw new Error(
        `Unsupported provider: ${provider}. Supported providers: anthropic, openai, google, mistral, xai, together`
      );
  }
}
