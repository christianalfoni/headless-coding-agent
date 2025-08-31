import fs from "fs";
import Together from "together-ai";
import { load_harmony_encoding, Message, Content } from "openai-harmony";

// Delete agent.log file when module loads
const logPath = "agent.log";
console.log(
  `Together Harmony SDK: agent.log path will be: ${process.cwd()}/${logPath}`
);
try {
  fs.unlinkSync(logPath);
  console.log(`Together Harmony SDK: Deleted existing agent.log`);
} catch (error) {
  // File doesn't exist or can't be deleted, that's okay
  console.log(`Together Harmony SDK: No existing agent.log to delete`);
}

// Remove SimpleMessage interface - using Message from openai-harmony instead

interface JsonSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  minItems?: number;
  maxItems?: number;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

interface JsonSchema {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
}

interface Tool {
  name: string;
  description?: string;
  input_schema: JsonSchema;
}

const client = new Together({
  apiKey: process.env.TOGETHER_AI_API_KEY,
});

export function convertJsonSchemaToHarmonyTypeScript(tools: Tool[]): string {
  if (tools.length === 0) {
    return "";
  }

  const convertProperty = (
    prop: JsonSchemaProperty,
    isRequired: boolean = false
  ): string => {
    let type = "";

    switch (prop.type) {
      case "string":
        if (prop.enum) {
          type = prop.enum.map((val) => `"${val}"`).join(" | ");
        } else {
          type = "string";
        }
        break;
      case "number":
      case "integer":
        type = "number";
        break;
      case "boolean":
        type = "boolean";
        break;
      case "array":
        if (prop.items) {
          const itemType = convertProperty(prop.items, true);
          type = `${itemType}[]`;
        } else {
          type = "any[]";
        }
        break;
      case "object":
        if (prop.properties) {
          const objectProps = Object.entries(prop.properties)
            .map(([key, value]) => {
              const required = prop.required?.includes(key) ?? false;
              const optional = required ? "" : "?";
              const comment = value.description
                ? `    // ${value.description}\n`
                : "";
              return `${comment}    ${key}${optional}: ${convertProperty(
                value,
                required
              )}`;
            })
            .join(",\n");
          type = `{\n${objectProps}\n  }`;
        } else {
          type = "object";
        }
        break;
      default:
        type = "any";
    }

    return type;
  };

  const functions = tools
    .map((tool) => {
      const { name, description, input_schema } = tool;
      const comment = description ? `  // ${description}\n` : "";

      if (
        !input_schema.properties ||
        Object.keys(input_schema.properties).length === 0
      ) {
        return `${comment}  type ${name} = () => any;`;
      }

      const properties = Object.entries(input_schema.properties)
        .map(([key, prop]) => {
          const isRequired = input_schema.required?.includes(key) ?? false;
          const optional = isRequired ? "" : "?";
          const propComment = prop.description
            ? `    // ${prop.description}\n`
            : "";
          return `${propComment}    ${key}${optional}: ${convertProperty(
            prop,
            isRequired
          )}`;
        })
        .join(",\n");

      return `${comment}  type ${name} = (_: {\n${properties}\n  }) => any;`;
    })
    .join("\n\n");

  return `namespace functions {\n${functions}\n}`;
}

export async function prompt(config: {
  messages: Message[];
  tools?: Tool[];
  reasoningEffort?: "low" | "medium" | "high";
}): Promise<{ content: Content[]; inputTokens: number; outputTokens: number }> {
  try {
    // Log function entry
    fs.appendFileSync(
      logPath,
      `=== HARMONY SDK CALLED ===\nMessages: ${
        config.messages.length
      }, Tools: ${config.tools?.length || 0}, Reasoning: ${
        config.reasoningEffort || "none"
      }\n==========================\n\n`
    );
    // 1. Load harmony encoding
    const encoding = await load_harmony_encoding("HarmonyGptOss");

    // 2. Use input messages directly since they're already in harmony format
    const harmonyMessages: Message[] = config.messages;

    // 3. Add tools if provided
    if (config.tools && config.tools.length > 0) {
      const toolsMessage: Message = {
        role: "developer",
        content: [
          {
            type: "text" as const,
            text: `# Tools\n${convertJsonSchemaToHarmonyTypeScript(
              config.tools
            )}`,
          },
        ],
      };
      harmonyMessages.unshift(toolsMessage);
    }

    // 4. Render conversation to tokens
    const inputTokensArray = encoding.renderConversationForCompletion(
      { messages: harmonyMessages },
      "assistant",
      { auto_drop_analysis: false }
    );

    // 5. Convert tokens to string for the API
    const promptText = encoding.decodeUtf8(inputTokensArray);

    // Log the actual tokens to agent.log
    try {
      fs.appendFileSync(
        logPath,
        `=== PROMPT TOKENS ===\n${promptText}\n\n=====================\n\n`
      );
    } catch (error) {
      // Ignore file write errors
    }

    // 6. Send to Together AI via SDK
    const completionParams: any = {
      messages: [{ role: "user", content: promptText }],
      model: "openai/gpt-oss-120b",
    };

    // Add reasoning effort if provided (convert to uppercase for harmony format)
    if (config.reasoningEffort) {
      completionParams.reasoning_effort = config.reasoningEffort.toUpperCase();
    }

    // Log the API call
    fs.appendFileSync(
      logPath,
      `=== API CALL ===\nParams: ${JSON.stringify(
        completionParams,
        null,
        2
      )}\n================\n\n`
    );

    const { data: completion } = await client.chat.completions
      .create(completionParams)
      .withResponse();

    // Log the API response
    fs.appendFileSync(
      logPath,
      `=== API RESPONSE ===\n${JSON.stringify(
        completion,
        null,
        2
      )}\n====================\n\n`
    );

    // 7. Extract completion content and usage from response
    const completionContent = completion.choices[0]?.message?.content;
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;

    if (!completionContent) {
      throw new Error("No completion content received from Together AI");
    }

    // 8. Encode the response back to tokens for parsing
    const responseTokens = encoding.encode(completionContent, new Set());

    // 9. Parse harmony response back to structured format
    const parsedResult =
      encoding.parseMessagesFromCompletionTokens(responseTokens);

    // 10. Parse the JSON result to get messages
    const parsedMessages = JSON.parse(parsedResult) as Message[];

    // 11. Return the content array from assistant messages, handling preemptive channel
    if (parsedMessages.length === 0) {
      return { content: [], inputTokens, outputTokens };
    }

    const allContent: Content[] = [];

    // Process all assistant messages
    for (const message of parsedMessages) {
      if (message.role === "assistant") {
        // Check if this is a preemptive channel message
        const isPreemptive = message.content.some(
          (content) =>
            content.type === "text" &&
            content.text.includes("<|channel|>preemptive<|message|>")
        );

        if (isPreemptive) {
          // Convert preemptive messages to plain text content
          for (const content of message.content) {
            if (content.type === "text") {
              // Extract the actual message content after the preemptive tag
              const preemptiveMatch = content.text.match(
                /<\|channel\|>preemptive<\|message\|>\s*(.*?)(?:<\|end\|>|$)/s
              );
              if (preemptiveMatch && preemptiveMatch[1]) {
                allContent.push({
                  type: "text",
                  text: preemptiveMatch[1].trim(),
                });
              }
            }
          }
        } else {
          // Add regular assistant message content
          allContent.push(...message.content);
        }
      }
    }

    return { content: allContent, inputTokens, outputTokens };
  } catch (error) {
    console.error("Error in together-harmony SDK:", error);
    throw error;
  }
}
