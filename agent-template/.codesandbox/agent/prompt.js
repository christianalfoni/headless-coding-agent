"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamPrompt = streamPrompt;
const ai_1 = require("ai");
async function* streamPrompt(config) {
    try {
        const result = await (0, ai_1.streamText)({
            model: config.usePlanningModel
                ? config.session.env.planningModel
                : config.session.env.model,
            system: config.system,
            prompt: config.prompt,
            tools: config.tools,
            toolChoice: config.toolChoice,
            stopWhen: config.maxSteps ? (0, ai_1.stepCountIs)(config.maxSteps) : undefined,
        });
        let textBuffer = "";
        let reasoningBuffer = "";
        let finalTextOutput = "";
        // Process the full stream and filter for specific part types
        for await (const part of result.fullStream) {
            part.type;
            const sessionInfo = {
                sessionId: config.session.sessionId,
            };
            // Ignore general stream control events
            if (part.type === "start" ||
                part.type === "start-step" ||
                part.type === "finish-step" ||
                part.type === "tool-input-start" ||
                part.type === "tool-input-delta" ||
                part.type === "tool-input-end") {
                continue;
            }
            // Handle text streaming
            if (part.type === "text-start") {
                config.session.step();
                continue; // Ignore text-start
            }
            if (part.type === "text-delta") {
                textBuffer += part.text;
                continue; // Don't yield delta, just buffer
            }
            if (part.type === "text-end") {
                // Yield custom text message with complete buffered text
                const textPart = {
                    type: "text",
                    text: textBuffer,
                    ...sessionInfo,
                };
                yield textPart;
                finalTextOutput = textBuffer; // Store as final output (only the last one)
                textBuffer = ""; // Reset buffer
                continue;
            }
            // Handle reasoning streaming
            if (part.type === "reasoning-start") {
                config.session.step();
                continue; // Ignore reasoning-start
            }
            if (part.type === "reasoning-delta") {
                reasoningBuffer += part.text;
                continue; // Don't yield delta, just buffer
            }
            if (part.type === "reasoning-end") {
                // Yield custom reasoning message with complete buffered reasoning
                const reasoningPart = {
                    type: "reasoning",
                    text: reasoningBuffer,
                    ...sessionInfo,
                };
                yield reasoningPart;
                reasoningBuffer = ""; // Reset buffer
                continue;
            }
            // Handle tool calls
            if (part.type === "tool-call") {
                config.session.step();
                if (part.toolName === "WriteTodos") {
                    continue; // Skip WriteTodos tool calls
                }
                const toolCallPart = {
                    type: "tool-call",
                    toolCallId: part.toolCallId,
                    toolName: part.toolName,
                    args: part.input,
                    ...sessionInfo,
                };
                yield toolCallPart;
                continue;
            }
            if (part.type === "tool-result") {
                if (part.toolName === "WriteTodos") {
                    const todosPart = {
                        type: "todos",
                        todos: part.output.todos,
                        ...sessionInfo,
                    };
                    yield todosPart;
                    continue;
                }
                const toolResultPart = {
                    type: "tool-result",
                    toolCallId: part.toolCallId,
                    toolName: part.toolName,
                    result: part.output,
                    ...sessionInfo,
                };
                yield toolResultPart;
                continue;
            }
            // Handle tool errors
            if (part.type === "tool-error") {
                const toolErrorPart = {
                    type: "tool-error",
                    toolCallId: part.toolCallId,
                    toolName: part.toolName,
                    error: part.error instanceof Error
                        ? part.error.message
                        : String(part.error),
                    ...sessionInfo,
                };
                yield toolErrorPart;
                continue;
            }
            // Handle finish event to track token usage
            if (part.type === "finish") {
                config.session.increaseTokens(part.totalUsage.inputTokens || 0, part.totalUsage.outputTokens || 0);
                continue;
            }
            // Handle error events
            if (part.type === "error") {
                const errorPart = {
                    type: "error",
                    error: part.error instanceof Error
                        ? part.error.message
                        : String(part.error),
                    ...sessionInfo,
                };
                yield errorPart;
                continue;
            }
            // For any unmatched message types, continue without yielding
            continue;
        }
        return finalTextOutput;
    }
    catch (error) {
        throw new Error(`Failed to stream prompt: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}
