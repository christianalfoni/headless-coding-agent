"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createModel = createModel;
const anthropic_1 = require("@ai-sdk/anthropic");
const openai_1 = require("@ai-sdk/openai");
const google_1 = require("@ai-sdk/google");
const mistral_1 = require("@ai-sdk/mistral");
const xai_1 = require("@ai-sdk/xai");
const togetherai_1 = require("@ai-sdk/togetherai");
function createModel(modelId) {
    // Default to Claude 3.5 Sonnet if no model specified
    const model = modelId || "anthropic/claude-sonnet-4-20250514";
    // Parse provider and model from format: "provider/model-name"
    const [provider, ...modelParts] = model.split("/");
    const modelName = modelParts.join("/");
    if (!provider || !modelName) {
        throw new Error(`Invalid model format: ${model}. Expected format: "provider/model-name"`);
    }
    switch (provider.toLowerCase()) {
        case "anthropic":
            const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
            if (!anthropicApiKey) {
                throw new Error("ANTHROPIC_API_KEY environment variable is required for Anthropic models");
            }
            return (0, anthropic_1.createAnthropic)({ apiKey: anthropicApiKey })(modelName);
        case "openai":
            const openaiApiKey = process.env.OPENAI_API_KEY;
            if (!openaiApiKey) {
                throw new Error("OPENAI_API_KEY environment variable is required for OpenAI models");
            }
            return (0, openai_1.createOpenAI)({ apiKey: openaiApiKey })(modelName);
        case "google":
            const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
            if (!googleApiKey) {
                throw new Error("GOOGLE_GENERATIVE_AI_API_KEY environment variable is required for Google models");
            }
            return (0, google_1.google)(modelName);
        case "mistral":
            const mistralApiKey = process.env.MISTRAL_API_KEY;
            if (!mistralApiKey) {
                throw new Error("MISTRAL_API_KEY environment variable is required for Mistral models");
            }
            return (0, mistral_1.createMistral)({ apiKey: mistralApiKey })(modelName);
        case "xai":
            const xaiApiKey = process.env.XAI_API_KEY;
            if (!xaiApiKey) {
                throw new Error("XAI_API_KEY environment variable is required for xAI models");
            }
            return (0, xai_1.createXai)({ apiKey: xaiApiKey })(modelName);
        case "together":
            const togetherApiKey = process.env.TOGETHER_AI_API_KEY;
            if (!togetherApiKey) {
                throw new Error("TOGETHER_AI_API_KEY environment variable is required for Together AI models");
            }
            return (0, togetherai_1.createTogetherAI)({ apiKey: togetherApiKey })(modelName);
        default:
            throw new Error(`Unsupported provider: ${provider}. Supported providers: anthropic, openai, google, mistral, xai, together`);
    }
}
