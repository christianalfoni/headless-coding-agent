#!/usr/bin/env node

import { query, Todo } from "./index.js";
import { createModels } from "./prompts.js";

function getModelForProvider(provider: "anthropic" | "openai" | "together"): string {
  switch (provider) {
    case "anthropic":
      return "claude-3-5-sonnet-20241022";
    case "openai":
      return "gpt-4o";
    case "together":
      return "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo";
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  let prompt = "";
  let format = false;
  let maxSteps: number | undefined;
  let provider: "anthropic" | "openai" | "together" = "anthropic";
  let planningModel: string | undefined;
  let initialTodos: Todo[] | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--prompt" && i + 1 < args.length) {
      prompt = args[i + 1];
      i++; // Skip the next argument
    } else if (args[i] === "--format") {
      format = true;
    } else if (args[i] === "--maxSteps" && i + 1 < args.length) {
      maxSteps = parseInt(args[i + 1], 10);
      if (isNaN(maxSteps) || maxSteps <= 0) {
        console.error("Error: maxSteps must be a positive number");
        process.exit(1);
      }
      i++; // Skip the next argument
    } else if (args[i] === "--provider" && i + 1 < args.length) {
      const providerArg = args[i + 1];
      if (
        providerArg === "anthropic" ||
        providerArg === "openai" ||
        providerArg === "together"
      ) {
        provider = providerArg;
      } else {
        console.error(
          "Error: provider must be 'anthropic', 'openai', or 'together'"
        );
        process.exit(1);
      }
      i++; // Skip the next argument
    } else if (args[i] === "--planningModel" && i + 1 < args.length) {
      planningModel = args[i + 1];
      i++; // Skip the next argument
    } else if (args[i] === "--todos" && i + 1 < args.length) {
      try {
        initialTodos = JSON.parse(args[i + 1]);
        if (!Array.isArray(initialTodos)) {
          console.error("Error: todos must be a JSON array");
          process.exit(1);
        }
        // Validate structure
        for (const todo of initialTodos) {
          if (!todo.description) {
            console.error('Error: Each todo must have a "description" field');
            process.exit(1);
          }
          if (!todo.context) {
            console.error('Error: Each todo must have a "context" field');
            process.exit(1);
          }
          if (
            todo.status &&
            !["pending", "in_progress", "completed"].includes(todo.status)
          ) {
            console.error(
              'Error: Todo status must be "pending", "in_progress", or "completed"'
            );
            process.exit(1);
          }
        }
      } catch (error) {
        console.error("Error: todos must be valid JSON");
        process.exit(1);
      }
      i++; // Skip the next argument
    }
  }

  if (!prompt) {
    console.error(
      'Usage: agent --prompt "your prompt here" [--format] [--maxSteps <number>] [--provider <string>] [--todos <json>]'
    );
    console.error("  --prompt: prompt to send to the agent");
    console.error("  --format: format JSON output (pretty print)");
    console.error(
      "  --maxSteps: maximum number of AI steps (default: unlimited)"
    );
    console.error(
      "  --provider: AI provider to use: anthropic, openai, or together (default: anthropic)"
    );
    console.error(
      "  --todos: JSON array of initial todos for session continuation"
    );
    process.exit(1);
  }

  return { prompt, format, maxSteps, provider, planningModel, initialTodos };
}

async function main() {
  try {
    const { prompt, format, maxSteps, provider, initialTodos } = parseArgs();

    const model = getModelForProvider(provider);
    const models = createModels(provider, model);

    const stream = query({
      prompt,
      workingDirectory: process.cwd(),
      maxSteps,
      todos: initialTodos,
      models,
    });

    for await (const part of stream) {
      if (format) {
        console.log(JSON.stringify(part, null, 2));
      } else {
        console.log(JSON.stringify(part));
      }
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
