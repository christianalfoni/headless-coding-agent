import { prompt as harmonyPrompt } from "./together-harmony-sdk.js";
import { Message } from "openai-harmony";
import {
  PromptMessage,
  WriteTodosCallMessage,
  WriteTodosResultMessage,
} from "./types.js";
import { Session } from "./Session.js";

/**
 * Simple Together AI with Harmony integration
 * 
 * This version uses the together-harmony-sdk for basic conversation
 * without tool calling support.
 */

export async function* streamPrompt(config: {
  session: Session;
  system: string;
  prompt: string;
  tools: Record<string, any>;
  maxSteps?: number;
  planningMode?: boolean;
  reasoningEffort?: "low" | "medium" | "high";
  verbosity?: "low" | "medium" | "high";
  returnOnToolResult?: string;
}): AsyncGenerator<
  PromptMessage | WriteTodosCallMessage | WriteTodosResultMessage
> {
  try {
    // Create harmony-compliant messages
    const messages: Message[] = [
      { 
        role: "system", 
        content: [{ 
          type: "text", 
          text: config.system
        }] 
      },
      { 
        role: "user", 
        content: [{ 
          type: "text", 
          text: config.prompt
        }] 
      },
    ];

    // Add preamble with commentary channel if in planning mode
    if (config.planningMode) {
      messages.push({
        role: "assistant",
        content: [{
          type: "text",
          text: "<|channel|>commentary<|message|>I'll help you plan this task step by step.<|end|>"
        }]
      });
    }

    const sessionInfo = {
      sessionId: config.session.sessionId,
    };

    // Call the harmony SDK
    const response = await harmonyPrompt({
      messages,
      reasoningEffort: config.reasoningEffort,
    });
    const responseContent = response.content;

    // Process each content item from the harmony response
    for (const content of responseContent) {
      if (content.type === "text") {
        // Check if this is a channeled message and extract appropriate content
        let text = content.text;
        let messageType: "text" | "reasoning" = "text";

        // Handle analysis channel (reasoning)
        if (text.includes("<|channel|>analysis<|message|>")) {
          const analysisMatch = text.match(/<\|channel\|>analysis<\|message\|>(.*?)(?:<\|end\|>|$)/s);
          if (analysisMatch && analysisMatch[1]) {
            text = analysisMatch[1].trim();
            messageType = "reasoning";
          }
        }
        // Handle commentary channel (keep as text but might be preamble)
        else if (text.includes("<|channel|>commentary<|message|>")) {
          const commentaryMatch = text.match(/<\|channel\|>commentary<\|message\|>(.*?)(?:<\|end\|>|$)/s);
          if (commentaryMatch && commentaryMatch[1]) {
            text = commentaryMatch[1].trim();
          }
        }
        // Handle final channel (default user-facing content)
        else if (text.includes("<|channel|>final<|message|>")) {
          const finalMatch = text.match(/<\|channel\|>final<\|message\|>(.*?)(?:<\|end\|>|$)/s);
          if (finalMatch && finalMatch[1]) {
            text = finalMatch[1].trim();
          }
        }

        const textMessage: PromptMessage = {
          type: messageType,
          text: text,
          ...sessionInfo,
        };
        yield textMessage;
      }
      // Note: Other types (system_content, developer_content) are ignored for now
    }

    // Update session with actual usage from API response
    const inputTokens = response.inputTokens;
    const outputTokens = response.outputTokens;
    
    // Calculate cost based on Together AI pricing for gpt-oss-120b
    // $0.15 input / $0.60 output per million tokens, converted to cents
    const cost = (inputTokens * 0.15 / 10000) + (outputTokens * 0.60 / 10000);
    
    config.session.step(inputTokens, outputTokens, cost);

    // Return the final text output
    const textContent = responseContent.find(c => c.type === "text");
    return textContent && "text" in textContent ? textContent.text : "";
    
  } catch (error) {
    const errorMessage: PromptMessage = {
      type: "error",
      error: error instanceof Error ? error.message : String(error),
      sessionId: config.session.sessionId,
    };
    yield errorMessage;

    throw new Error(
      `Failed to stream prompt: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
