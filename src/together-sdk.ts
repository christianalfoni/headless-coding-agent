import fs from "fs";
import Together from "together-ai";

// Delete agent.log file when module loads
try {
  fs.unlinkSync("agent.log");
} catch (error) {
  // File doesn't exist or can't be deleted, that's okay
}

export interface TogetherMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TogetherTool {
  id: string;
  name: string;
  description: string;
  parameters: any;
}

export interface TogetherRequest {
  temperature?: number;
  model: string;
  messages: TogetherMessage[];
  stream?: boolean;
  tools?: TogetherTool[];
  reasoning_effort?: "low" | "medium" | "high";
}

export interface TogetherToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface TogetherUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  reasoning_tokens: number;
}

export interface TogetherResponse {
  reasoning?: string;
  text?: string;
  toolCalls?: TogetherToolCall[];
  usage?: TogetherUsage;
  id?: string;
  model?: string;
}

export class TogetherSDK {
  private client: Together;

  constructor(apiKey: string) {
    this.client = new Together({
      apiKey: apiKey,
    });
  }


  /**
   * Fallback parsing for non-harmony responses
   * Uses the original JSON parsing logic as backup
   */
  private parseFallbackResponse(
    content: string,
    availableTools: TogetherTool[]
  ): {
    reasoning: string | null;
    text: string | null;
    toolCalls: TogetherToolCall[];
  } {
    // Check for harmony-style response with reasoning and tool calls
    let reasoning: string | null = null;
    let text: string | null = null;
    let toolCalls: TogetherToolCall[] = [];

    // Extract reasoning from "analysis" section
    if (content.includes("analysis")) {
      const analysisMatch = content.match(/analysis(.*?)(?=assistant|$)/s);
      if (analysisMatch && analysisMatch[1]) {
        reasoning = analysisMatch[1].trim();
      }
    }

    // Try to find JSON tool call at the end
    const jsonMatch = content.match(/\{[^}]*"name"[^}]*"parameters"[^}]*\}/);
    if (jsonMatch) {
      const toolCall = this.tryParseToolCall(jsonMatch[0], availableTools);
      if (toolCall) {
        toolCalls.push(toolCall);
      }
    }

    // Use original content as text if no reasoning was extracted
    if (!reasoning) {
      text = content;
    } else {
      // If we have reasoning, extract remaining text (excluding the tool call JSON)
      let remainingText = content;
      if (reasoning) {
        remainingText = remainingText.replace(/analysis.*?(?=assistant|$)/s, '').trim();
      }
      if (jsonMatch) {
        remainingText = remainingText.replace(jsonMatch[0], '').trim();
      }
      text = remainingText || null;
    }

    return {
      reasoning,
      text,
      toolCalls,
    };
  }

  /**
   * Legacy tool call parsing logic (fallback)
   */
  private tryParseToolCall(
    text: string,
    availableTools: TogetherTool[]
  ): TogetherToolCall | null {
    let cleanedText = text.trim();
    const lowerText = cleanedText.toLowerCase();

    if (lowerText.startsWith("final")) {
      cleanedText = cleanedText.substring(5);
      if (cleanedText.startsWith("{")) {
        // No space after prefix, that's fine
      } else {
        cleanedText = cleanedText.trim();
      }
    } else if (lowerText.startsWith("json")) {
      cleanedText = cleanedText.substring(4);
      if (cleanedText.startsWith("{")) {
        // No space after prefix, that's fine
      } else {
        cleanedText = cleanedText.trim();
      }
    }

    try {
      const parsed = JSON.parse(cleanedText);

      if (
        parsed &&
        typeof parsed === "object" &&
        parsed.name &&
        parsed.parameters
      ) {
        const toolExists = availableTools.some(
          (tool) => tool.name === parsed.name
        );
        if (!toolExists && availableTools.length > 0) {
          fs.appendFileSync(
            "agent.log",
            `INVALID TOOL USAGE - Unknown tool: ${
              parsed.name
            }. Available tools: ${availableTools
              .map((t) => t.name)
              .join(", ")}\n`
          );
          return null;
        }

        const toolCallId = `call_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 11)}`;

        return {
          id: toolCallId,
          type: "function",
          function: {
            name: parsed.name,
            arguments: JSON.stringify(parsed.parameters),
          },
        };
      }
    } catch (error) {
      if (
        text.trim().includes('"name"') &&
        text.trim().includes('"parameters"')
      ) {
        fs.appendFileSync(
          "agent.log",
          `JSON PARSE FAILURE - Looks like incomplete tool call:\nOriginal: ${text}\nCleaned: ${cleanedText}\nError: ${
            error instanceof Error ? error.message : String(error)
          }\n`
        );
      }
    }

    return null;
  }

  async createChatCompletion(
    request: TogetherRequest
  ): Promise<TogetherResponse> {
    try {

      // Clone the request to avoid mutating the original
      const processedRequest = { ...request };

      // Add tool definitions to system message if tools are provided
      if (request.tools && request.tools.length > 0) {
        processedRequest.messages = [...request.messages];

        const firstSystemMessageIndex = processedRequest.messages.findIndex(
          (msg) => msg.role === "system"
        );

        if (firstSystemMessageIndex !== -1) {
          let additionalInstructions = `\n\nAVAILABLE TOOLS:
${request.tools
  .map((tool) => `${tool.name}: ${JSON.stringify(tool, null, 2)}`)
  .join("\n\n")}

TOOL EXECUTION FORMAT:
When you need to execute a tool, respond with a JSON object in this exact format:
{"name": "tool_name", "parameters": {"param1": "value1", "param2": "value2"}}

Examples:
{"name": "bash", "parameters": {"command": "ls -la"}}
{"name": "write_todos", "parameters": {"todos": [{"description": "Create HTML file", "reasoningEffort": "low"}]}}

IMPORTANT TOOL USAGE RULES:
- Use the exact tool names and parameter names shown in the tool definitions above
- Always provide a complete JSON object with "name" and "parameters" fields
- Use proper JSON syntax with double quotes for strings
- Only call ONE tool at a time, then wait for the result
- After receiving a tool result, you can call another tool if needed`;

          processedRequest.messages[firstSystemMessageIndex] = {
            ...processedRequest.messages[firstSystemMessageIndex],
            content:
              processedRequest.messages[firstSystemMessageIndex].content +
              additionalInstructions,
          };
        }
      }

      // Log the messages being sent to the API (truncate system message)
      try {
        const logMessages = processedRequest.messages.map((msg) => {
          if (msg.role === "system" && msg.content && msg.content.length > 200) {
            return {
              ...msg,
              content: msg.content.substring(0, 200) + "... [TRUNCATED]",
            };
          }
          return msg;
        });
        fs.appendFileSync(
          "agent.log",
          `=== REQUEST MESSAGES ===\n${JSON.stringify(
            logMessages,
            null,
            2
          )}\n========================\n`
        );
      } catch (error) {
        // Ignore file write errors
      }

      // Make request using official Together SDK with raw response
      const { data: chatCompletion } = await this.client.chat.completions
        .create({
          model: processedRequest.model,
          messages: processedRequest.messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          temperature: processedRequest.temperature,
          reasoning_effort: processedRequest.reasoning_effort,
          top_p: 0.8,
          stream: false,
          max_tokens: 4000,
          // Don't pass tools to SDK - we handle them via system prompt
        })
        .withResponse();

      // Extract usage information
      const usage: TogetherUsage | undefined = chatCompletion.usage
        ? {
            prompt_tokens: chatCompletion.usage.prompt_tokens || 0,
            completion_tokens: chatCompletion.usage.completion_tokens || 0,
            total_tokens: chatCompletion.usage.total_tokens || 0,
            reasoning_tokens:
              (chatCompletion.usage as any).reasoning_tokens || 0,
          }
        : undefined;

      // Log response for debugging
      try {
        fs.appendFileSync(
          "agent.log",
          `=== RESPONSE DATA ===\n${JSON.stringify(
            {
              id: chatCompletion.id,
              model: chatCompletion.model,
              choices: chatCompletion.choices,
              usage: chatCompletion.usage,
            },
            null,
            2
          )}\n=====================\n`
        );
      } catch (error) {
        // Ignore file write errors
      }

      // Extract the first choice content
      const firstChoice = chatCompletion.choices?.[0];
      if (!firstChoice?.message?.content) {
        return {
          reasoning: undefined,
          text: undefined,
          toolCalls: [],
          usage,
          id: chatCompletion.id,
          model: chatCompletion.model,
        };
      }

      const messageContent = firstChoice.message.content;

      // Try to get raw response tokens for harmony parsing
      let parsedContent: {
        reasoning: string | null;
        text: string | null;
        toolCalls: TogetherToolCall[];
      };

      // Use fallback parsing for all responses for now
      // (harmony parsing disabled due to WASM issues)
      parsedContent = this.parseFallbackResponse(
        messageContent,
        request.tools || []
      );

      return {
        reasoning: parsedContent.reasoning || undefined,
        text: parsedContent.text || undefined,
        toolCalls: parsedContent.toolCalls || [],
        usage,
        id: chatCompletion.id,
        model: chatCompletion.model,
      };
    } catch (error) {
      // Log the error for debugging
      fs.appendFileSync(
        "agent.log",
        `=== SDK ERROR ===\n${
          error instanceof Error ? error.message : String(error)
        }\n=================\n`
      );

      // Re-throw with helpful error message
      if (error instanceof Error) {
        throw new Error(`Together SDK error: ${error.message}`);
      }
      throw new Error(`Together SDK error: ${String(error)}`);
    }
  }
}