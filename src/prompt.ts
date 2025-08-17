import { streamText, Tool, stepCountIs } from "ai";
import { Session, Message } from "./types";

export async function* streamPrompt(config: {
  session: Session;
  system: string;
  prompt: string;
  tools: Record<string, Tool>;
  toolChoice: "auto" | "required";
  maxSteps?: number;
}): AsyncGenerator<Message> {
  try {
    const result = await streamText({
      model: config.session.env.model,
      system: config.system,
      prompt: config.prompt,
      tools: config.tools,
      toolChoice: config.toolChoice,
      stopWhen: config.maxSteps ? stepCountIs(config.maxSteps) : undefined,
    });

    let textBuffer = "";
    let reasoningBuffer = "";
    let finalTextOutput = "";

    // Process the full stream and filter for specific part types
    for await (const part of result.fullStream) {
      part.type;
      const sessionInfo = {
        sessionId: config.session.sessionId,
        parentSessionId: config.session.parentSession?.sessionId,
      };

      // Ignore general stream control events
      if (
        part.type === "start" ||
        part.type === "start-step" ||
        part.type === "finish-step" ||
        part.type === "tool-input-start" ||
        part.type === "tool-input-delta" ||
        part.type === "tool-input-end"
      ) {
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
        const textPart: Message = {
          type: "text",
          text: textBuffer,
          ...sessionInfo,
        };
        yield textPart;
        finalTextOutput += textBuffer; // Add to final output
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
        const reasoningPart: Message = {
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

        const toolCallPart: Message = {
          type: "tool-call",
          toolCallId: part.toolCallId,
          toolName: part.toolName as any,
          args: part.input,
          ...sessionInfo,
        } as any;
        yield toolCallPart;
        continue;
      }

      if (part.type === "tool-result") {
        if (part.toolName === "WriteTodos") {
          const todosPart: Message = {
            type: "todos",
            todos: part.output.todos,
            ...sessionInfo,
          };
          yield todosPart;
          continue;
        }

        const toolResultPart: Message = {
          type: "tool-result",
          toolCallId: part.toolCallId,
          toolName: part.toolName as any,
          result: part.output,
          ...sessionInfo,
        } as any;
        yield toolResultPart;
        continue;
      }

      // Handle tool errors
      if (part.type === "tool-error") {
        const toolErrorPart: Message = {
          type: "tool-error",
          toolCallId: part.toolCallId,
          toolName: part.toolName as any,
          error: part.error instanceof Error ? part.error.message : String(part.error),
          ...sessionInfo,
        } as any;
        yield toolErrorPart;
        continue;
      }

      // Handle finish event to track token usage
      if (part.type === "finish") {
        config.session.increaseTokens(
          part.totalUsage.inputTokens || 0,
          part.totalUsage.outputTokens || 0
        );

        // If this is a root session (no parent), emit a completed event instead
        if (!config.session.parentSession) {
          const durationMs = Date.now() - config.session.startTime.getTime();
          const completedPart: Message = {
            type: "completed",
            inputTokens: config.session.inputTokens,
            outputTokens: config.session.outputTokens,
            stepCount: config.session.stepCount,
            durationMs,
            todos: config.session.todos,
            ...sessionInfo,
          };
          yield completedPart;
          continue;
        }

        // For non-root sessions, emit the finish message
        const finishPart: Message = {
          type: "finish",
          inputTokens: part.totalUsage.inputTokens || 0,
          outputTokens: part.totalUsage.outputTokens || 0,
          ...sessionInfo,
        };
        yield finishPart;
        continue;
      }

      // Handle error events
      if (part.type === "error") {
        const errorPart: Message = {
          type: "error",
          error:
            part.error instanceof Error
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
  } catch (error) {
    throw new Error(
      `Failed to stream prompt: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
