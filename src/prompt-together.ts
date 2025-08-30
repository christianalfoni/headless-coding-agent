import { Together } from "together-ai";
import {
  PromptMessage,
  WriteTodosCallMessage,
  WriteTodosResultMessage,
} from "./types";
import { Session } from "./Session";

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
    const client = new Together({
      apiKey: process.env.TOGETHER_API_KEY,
    });

    // Convert tools from Anthropic format to OpenAI format
    const openaiTools = Object.values(config.tools).map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
      strict: tool.name === "write_todos",
    }));

    let messages: Array<{
      role: "system" | "user" | "assistant" | "tool";
      content: string | null;
      tool_calls?: any[];
      tool_call_id?: string;
    }> = [
      {
        role: "system",
        content: config.system,
      },
      {
        role: "user",
        content: config.prompt,
      },
    ];

    let stepCount = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let finalTextOutput = "";

    const sessionInfo = {
      sessionId: config.session.sessionId,
    };

    // Main conversation loop - continues only when there are tool calls to process
    while (true) {
      const response = await client.chat.completions.create({
        model: "deepseek-ai/DeepSeek-R1",
        max_tokens: 4000,
        messages: messages as any,
        reasoning_effort:
          config.reasoningEffort === "low" ? undefined : config.reasoningEffort,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
        tool_choice: openaiTools.length > 0 ? "auto" : undefined,
        stream: false,
        temperature: config.reasoningEffort === "low" ? 0.2 : undefined,
      });

      const responseInputTokens = response.usage?.prompt_tokens || 0;
      const responseOutputTokens = response.usage?.completion_tokens || 0;
      totalInputTokens += responseInputTokens;
      totalOutputTokens += responseOutputTokens;

      // Calculate cost for this response and call step (Together AI pricing for DeepSeek-V3)
      const responseCost =
        responseInputTokens * 0.0002 + responseOutputTokens * 0.0002;
      config.session.step(
        responseInputTokens,
        responseOutputTokens,
        responseCost
      );

      const choice = response.choices[0];
      if (!choice?.message) break;

      // Handle text content
      const textContent = choice.message.content;
      if (textContent) {
        const textMessage: PromptMessage = {
          type: "text",
          text: textContent,
          ...sessionInfo,
        };
        yield textMessage;
        finalTextOutput = textContent;
      }

      // Handle tool calls
      const toolCalls = choice.message.tool_calls || [];
      const hasToolCalls = toolCalls.length > 0;

      if (!hasToolCalls) {
        // No tool calls, conversation is complete
        break;
      }

      // Check step limits when we continue the loop
      if (config.maxSteps && stepCount >= config.maxSteps) {
        break;
      }

      stepCount++;

      // Add assistant's response to messages for continuation
      messages.push({
        role: "assistant",
        content: textContent,
        tool_calls: toolCalls,
      });

      // Process tool calls
      if (hasToolCalls) {
        const toolResults: any[] = [];

        for (const toolCall of toolCalls) {
          if (!toolCall.id || !toolCall.function?.name) continue;

          // Yield tool call message
          let parsedArgs;
          try {
            parsedArgs = JSON.parse(toolCall.function.arguments || "{}");
          } catch {
            parsedArgs = {};
          }

          const toolCallMessage: PromptMessage = {
            type: "tool-call",
            toolCallId: toolCall.id,
            toolName: toolCall.function.name as any,
            args: parsedArgs,
            ...sessionInfo,
          } as any;
          yield toolCallMessage;

          try {
            // Execute the tool
            const tool = Object.values(config.tools).find(
              (t) => t.name === toolCall.function.name
            );
            if (!tool) {
              throw new Error(`Tool ${toolCall.function.name} not found`);
            }

            const result = await tool.execute(parsedArgs);

            // Yield tool result message
            const toolResultMessage: PromptMessage = {
              type: "tool-result",
              toolCallId: toolCall.id,
              toolName: toolCall.function.name as any,
              result,
              ...sessionInfo,
            } as any;
            yield toolResultMessage;

            // Return early if configured to do so
            if (
              config.returnOnToolResult &&
              toolCall.function.name === config.returnOnToolResult
            ) {
              return finalTextOutput;
            }

            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content:
                typeof result === "string" ? result : JSON.stringify(result),
            });
          } catch (error) {
            // Yield tool error message
            const toolErrorMessage: PromptMessage = {
              type: "tool-error",
              toolCallId: toolCall.id,
              toolName: toolCall.function.name as any,
              error: error instanceof Error ? error.message : String(error),
              ...sessionInfo,
            } as any;
            yield toolErrorMessage;

            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: `Error: ${
                error instanceof Error ? error.message : String(error)
              }`,
            });
          }
        }

        // Add tool results to messages
        if (toolResults.length > 0) {
          messages.push(...toolResults);
        }
      }
    }

    return finalTextOutput;
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
