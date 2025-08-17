import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createXai } from "@ai-sdk/xai";
import { createTogetherAI } from "@ai-sdk/togetherai";

export function createModel(modelId?: string) {
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
      return createAnthropic({ apiKey: anthropicApiKey })(modelName);

    case "openai":
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        throw new Error(
          "OPENAI_API_KEY environment variable is required for OpenAI models"
        );
      }
      return createOpenAI({ apiKey: openaiApiKey })(modelName);

    case "google":
      const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!googleApiKey) {
        throw new Error(
          "GOOGLE_GENERATIVE_AI_API_KEY environment variable is required for Google models"
        );
      }
      return google(modelName);

    case "mistral":
      const mistralApiKey = process.env.MISTRAL_API_KEY;
      if (!mistralApiKey) {
        throw new Error(
          "MISTRAL_API_KEY environment variable is required for Mistral models"
        );
      }
      return createMistral({ apiKey: mistralApiKey })(modelName);

    case "xai":
      const xaiApiKey = process.env.XAI_API_KEY;
      if (!xaiApiKey) {
        throw new Error(
          "XAI_API_KEY environment variable is required for xAI models"
        );
      }
      return createXai({ apiKey: xaiApiKey })(modelName);

    case "together":
      const togetherApiKey = process.env.TOGETHER_AI_API_KEY;
      if (!togetherApiKey) {
        throw new Error(
          "TOGETHER_AI_API_KEY environment variable is required for Together AI models"
        );
      }
      return createTogetherAI({ apiKey: togetherApiKey })(modelName);

    default:
      throw new Error(
        `Unsupported provider: ${provider}. Supported providers: anthropic, openai, google, mistral, xai, together`
      );
  }
}
