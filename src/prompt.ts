import { streamText, Tool, stepCountIs } from "ai";
import { Session, SessionStreamPart } from "./types";

export async function* streamPrompt(config: {
  session: Session;
  system: string;
  prompt: string;
  tools: Record<string, Tool>;
  toolChoice: "auto" | "required";
  maxSteps?: number;
}): AsyncGenerator<SessionStreamPart<any>> {
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
        const textPart: SessionStreamPart<any> = {
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
        const reasoningPart: SessionStreamPart<any> = {
          type: "reasoning",
          reasoning: reasoningBuffer,
          ...sessionInfo,
        };
        yield reasoningPart;
        reasoningBuffer = ""; // Reset buffer
        continue;
      }

      // Handle tool calls
      if (part.type === "tool-call") {
        config.session.step();
      }

      if (part.type === "tool-call" && part.toolName === "WriteTodos") {
        continue;
      }

      if (part.type === "tool-result" && part.toolName === "WriteTodos") {
        const reasoningPart: SessionStreamPart<any> = {
          type: "todos",
          todos: part.output.todos,
          ...sessionInfo,
        };

        yield reasoningPart;
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
          const completedPart: SessionStreamPart<any> = {
            type: "completed",
            inputTokens: config.session.inputTokens,
            outputTokens: config.session.outputTokens,
            stepCount: config.session.stepCount,
            durationMs,
            ...sessionInfo,
          };
          yield completedPart;
          continue; // Don't emit the original finish event
        }
      }

      // For all other parts, pass through with session info
      const sessionPart: SessionStreamPart<any> = {
        ...part,
        ...sessionInfo,
      };

      yield sessionPart;
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
