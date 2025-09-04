import fs from "fs";
import { load_harmony_encoding, Message, Role } from "openai-harmony";

// Delete agent.log file when module loads
const logPath = "../agent.log";
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

// Raw message format from parseMessagesFromCompletionTokens
interface RawParsedMessage {
  role: string;
  content: string;
  channel?: string;
  recipient?: string;
  name?: string;
}

// Convert raw parsed messages to proper Message format
function convertRawMessagesToMessages(rawMessages: RawParsedMessage[]): Message[] {
  return rawMessages.map(raw => ({
    role: raw.role as Role,
    content: [{ type: "text" as const, text: raw.content }],
    channel: raw.channel,
    recipient: raw.recipient,
    name: raw.name
  }));
}

export async function prompt(config: {
  messages: Message[];
  tools?: Tool[];
  reasoningEffort?: "low" | "medium" | "high";
  apiKey: string;
}): Promise<{ messages: Message[]; inputTokens: number; outputTokens: number }> {
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

    // 3. Add reasoning effort to system message if provided
    if (config.reasoningEffort) {
      const systemMessage = harmonyMessages.find((m) => m.role === "system");
      if (systemMessage && systemMessage.content[0]?.type === "text") {
        systemMessage.content[0].text += `\n<|reasoning|>${config.reasoningEffort.toUpperCase()}`;
      }
    }

    // 4. Add tools if provided
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

    // 5. Render conversation to tokens
    const inputTokensArray = encoding.renderConversationForCompletion(
      { messages: harmonyMessages },
      "assistant",
      { auto_drop_analysis: false }
    );

    // 6. Convert tokens to string for the API
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

    // Log the API call
    fs.appendFileSync(
      logPath,
      `=== API CALL ===\nParams: ${JSON.stringify(
        promptText,
        null,
        2
      )}\n================\n\n`
    );

    const response = await fetch(
      "https://api.fireworks.ai/inference/v1/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "accounts/fireworks/models/gpt-oss-120b",
          prompt: promptText,
          max_tokens: 2048,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Fireworks API request failed: ${response.status} ${response.statusText}`
      );
    }

    const completion = await response.json();

    // Log the API response
    fs.appendFileSync(
      logPath,
      `=== API RESPONSE ===\n${JSON.stringify(
        completion,
        null,
        2
      )}\n====================\n\n`
    );

    // 8. Extract completion content and usage from response
    const completionContent = completion.choices[0].text;
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;

    if (!completionContent) {
      throw new Error("No completion content received from Together AI");
    }

    // 9. Parse harmony response using openai-harmony  
    let parsedMessages: Message[];

    // Build the full conversation by concatenating prompt + completion
    // Fix incomplete harmony responses by ensuring they end with <|end|>
    let fixedCompletionContent = completionContent;
    if (!completionContent.trim().endsWith("<|end|>")) {
      fixedCompletionContent = completionContent + "<|end|>";
    }
    const fullConversation = promptText + fixedCompletionContent;

    // Remove the full conversation logging - too verbose

    try {
      // Use the original input tokens + encode just the completion
      const completionTokens = encoding.encode(
        fixedCompletionContent,
        new Set(["<|start|>", "<|end|>", "<|message|>", "<|channel|>"])
      );

      // Combine original input tokens with completion tokens
      const fullTokens = new Uint32Array(
        inputTokensArray.length + completionTokens.length
      );
      fullTokens.set(inputTokensArray, 0);
      fullTokens.set(completionTokens, inputTokensArray.length);

      // Log token info for debugging
      fs.appendFileSync(
        logPath,
        `=== TOKEN INFO ===\nInput tokens: ${
          inputTokensArray.length
        }, Completion tokens: ${completionTokens.length}, Total: ${
          fullTokens.length
        }\nFirst few input tokens: ${Array.from(
          inputTokensArray.slice(0, 5)
        )}\nFirst few completion tokens: ${Array.from(
          completionTokens.slice(0, 5)
        )}\n==================\n\n`
      );

      // Parse the complete conversation tokens as messages
      const parsedResult =
        encoding.parseMessagesFromCompletionTokens(fullTokens);
      
      // Log the raw parsed result before JSON parsing
      fs.appendFileSync(
        logPath,
        `=== RAW PARSED RESULT ===\n${parsedResult}\n=========================\n\n`
      );
      
      const rawParsedMessages = JSON.parse(parsedResult) as RawParsedMessage[];
      parsedMessages = convertRawMessagesToMessages(rawParsedMessages);
    } catch (error) {
      fs.appendFileSync(
        logPath,
        `=== PARSING ERROR ===\n${error}\n======================\n\n`
      );
      throw error;
    }

    // 11. Return the NEW assistant messages (response only)
    if (parsedMessages.length === 0) {
      return { messages: [], inputTokens, outputTokens };
    }

    // Get the actual count of input messages that went into rendering
    // This should match the length of harmonyMessages after all modifications
    const originalMessageCount = harmonyMessages.length;

    // Process only the NEW assistant messages from the response
    const newMessages = parsedMessages.slice(originalMessageCount);

    // Debug: Log the new messages structure
    fs.appendFileSync(
      logPath,
      `=== NEW MESSAGES DEBUG ===\nOriginal message count: ${originalMessageCount}\nTotal parsed messages: ${parsedMessages.length}\nNew messages: ${JSON.stringify(newMessages, null, 2)}\n==========================\n\n`
    );

    // Return all new messages (no role filtering needed)
    const result = { messages: newMessages, inputTokens, outputTokens };
    
    // Log the final result we're returning
    fs.appendFileSync(
      logPath,
      `=== FINAL RESULT ===\n${JSON.stringify(result, null, 2)}\n====================\n\n`
    );
    
    return result;
  } catch (error) {
    console.error("Error in together-harmony SDK:", error);
    throw error;
  }
}
