#!/usr/bin/env node

import { query } from "../dist/index.js";
import { createModels } from "../dist/prompts.js";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import boxen from "boxen";
import process from "process";
import fs from "fs";

function getModelForProvider(provider) {
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

class AgentChat {
  constructor(provider = "anthropic") {
    this.isAgentRunning = false;
    this.lastTodos = null;
    this.currentSpinner = null;
    this.provider = provider;
    this.lastPwd = null;
    this.logFileName = `../agent-chat-${
      new Date().toISOString().split("T")[0]
    }.log`;
  }

  logMessage(message) {
    try {
      fs.appendFileSync(this.logFileName, message + "\n\n", "utf8");
    } catch (error) {
      console.error("Failed to write to log file:", error.message);
    }
  }

  displayWelcome() {
    console.log(
      boxen(
        chalk.cyan.bold("🤖 Headless Agent Chat Interface") +
          "\n\n" +
          chalk.gray("Type your prompts to interact with the agent.\n") +
          chalk.gray('Type "exit" or "quit" to leave.\n') +
          chalk.gray(`Using provider: ${this.provider}`),
        {
          padding: 1,
          margin: 1,
          borderStyle: "round",
          borderColor: "cyan",
        }
      )
    );
  }

  truncateInput(input, maxLines = 4) {
    if (typeof input !== "string") {
      input = JSON.stringify(input);
    }
    const lines = input.split("\n");
    if (lines.length > maxLines) {
      const truncated = lines.slice(0, maxLines).join("\n");
      const remainingLines = lines.length - maxLines;
      return `${truncated}\n...+ ${remainingLines} lines`;
    }
    return input;
  }

  formatAgentOutput(part) {
    switch (part.type) {
      case "text":
        return chalk.white("💬 ") + part.text;

      case "reasoning":
        return chalk.gray("🧠 ") + chalk.gray(part.text);

      case "tool-call":
        let toolDescription = chalk.blue.bold(part.toolName);
        if (part.toolName === "write_todos") {
          const todoCount = part.args.todos ? part.args.todos.length : 0;
          toolDescription += chalk.gray(` (updating ${todoCount} todos)`);
        } else if (part.toolName === "bash") {
          if (part.args.restart) {
            toolDescription += chalk.gray(` (restart shell)`);
          } else if (part.args.command) {
            const command = this.truncateInput(part.args.command);
            toolDescription += chalk.gray(` (${command})`);
          }
        } else if (part.toolName === "str_replace_based_edit_tool") {
          const command = part.args.command;
          const path = part.args.path;
          if (command === "view") {
            if (part.args.view_range) {
              toolDescription += chalk.gray(
                ` (${command} ${path}:${part.args.view_range[0]}-${part.args.view_range[1]})`
              );
            } else {
              toolDescription += chalk.gray(` (${command} ${path})`);
            }
          } else if (command === "create") {
            toolDescription += chalk.gray(` (${command} ${path})`);
          } else if (command === "str_replace") {
            const oldText = this.truncateInput(part.args.old_str);
            const newText = this.truncateInput(part.args.new_str);
            toolDescription += chalk.gray(
              ` (${command} ${path}: "${oldText}" → "${newText}")`
            );
          } else if (command === "insert") {
            const newText = this.truncateInput(part.args.new_str);
            toolDescription += chalk.gray(
              ` (${command} ${path}:${part.args.insert_line}: "${newText}")`
            );
          } else {
            toolDescription += chalk.gray(` (${command} ${path})`);
          }
        } else if (part.toolName === "web_fetch") {
          toolDescription += chalk.gray(` (${part.args.url})`);
        } else if (part.toolName === "web_search") {
          toolDescription += chalk.gray(` ("${part.args.query}")`);
        }
        return chalk.blue("🔧 ") + toolDescription;

      case "tool-result":
        // Only show results for write_todos to track todo updates, and for errors
        if (part.toolName === "write_todos") {
          const todoCount = part.result.todos ? part.result.todos.length : 0;
          // Update the current todos
          if (part.result.todos) {
            this.lastTodos = part.result.todos;
          }
          return chalk.green("✅ ") + chalk.gray(`todos updated (${todoCount} todos)`);
        } else if (part.toolName === "bash") {
          const exitCode = part.result.exitCode;
          const pwd = part.result.pwd || part.result.workingDirectory;
          if (exitCode !== 0) {
            return chalk.red("❌ ") + chalk.red(`bash failed with exit code ${exitCode}`);
          } else if (pwd) {
            // Check if working directory changed
            if (this.lastPwd && this.lastPwd !== pwd) {
              this.lastPwd = pwd;
              return chalk.green("✅ ") + chalk.blue("📁 ") + chalk.gray(`directory changed to ${pwd}`);
            } else {
              this.lastPwd = pwd;
              return chalk.green("✅ ") + chalk.gray(`executed in ${pwd}`);
            }
          }
        } else if (part.toolName === "str_replace_based_edit_tool") {
          if (part.result.includes("Error:")) {
            return chalk.red("❌ ") + chalk.red("edit failed with errors");
          }
        }
        // Return empty string for successful tool results (don't show anything)
        return "";

      case "tool-error":
        return (
          chalk.red("❌ Tool Error: ") +
          chalk.red.bold(part.toolName) + "\n" +
          chalk.red("   Error: ") + chalk.red(part.error)
        );

      case "todos":
        if (part.todos && part.todos.length > 0) {
          this.lastTodos = part.todos;
          
          // Find the last completed todo
          const completedTodos = part.todos.filter(todo => todo.status === "completed");
          const lastCompletedTodo = completedTodos.length > 0 ? completedTodos[completedTodos.length - 1] : null;
          
          return (
            chalk.magenta("📋 Todos Updated ") + chalk.yellow(`(${part.reasoningEffort})`) + "\n" +
            part.todos
              .map((todo) => {
                const statusIcon =
                  todo.status === "completed"
                    ? "✅"
                    : todo.status === "in_progress"
                    ? "🔄"
                    : "⏳";
                
                return `  ${statusIcon} ` + chalk.yellow(`(${todo.reasoningEffort})`) + ` ${todo.description}`;
              })
              .join("\n")
          );
        }
        return "";

      case "completed":
        this.lastTodos = part.todos; // Save completed todos
        const duration = (part.durationMs / 1000).toFixed(1);
        return (
          chalk.green("🏁 ") +
          chalk.gray(
            `Completed in ${part.stepCount} steps, ${
              part.inputTokens + part.outputTokens
            } tokens (${part.inputTokens} in, ${
              part.outputTokens
            } out), ${duration}s`
          )
        );

      case "error":
        return (
          chalk.red("💥 ") +
          chalk.red.bold("Session Error: ") +
          chalk.red(part.error)
        );

      default:
        return chalk.gray("📝 ") + JSON.stringify(part, null, 2);
    }
  }

  async executeAgent(prompt) {
    try {
      this.isAgentRunning = true;

      // Prepare todos from previous session if available

      this.currentSpinner = ora("🤖 Agent is thinking...").start();
      let hasOutput = false;

      // Use the SDK query function
      const model = getModelForProvider(this.provider);
      const models = createModels(this.provider, model);
      
      for await (const part of query({
        prompt,
        workingDirectory: process.cwd(),
        maxSteps: 200,
        todos: this.lastTodos,
        models,
      })) {
        if (this.currentSpinner) {
          this.currentSpinner.stop();
          this.currentSpinner = null;
          hasOutput = true;
        }

        const formatted = this.formatAgentOutput(part);
        if (formatted) {
          console.log(formatted);
          console.log(); // Add line break between messages
        }

        // Log the raw JSON message
        this.logMessage(JSON.stringify(part, null, 2));
      }

      this.isAgentRunning = false;

      if (!hasOutput) {
        console.log(chalk.green("✨ Agent completed successfully (no output)"));
      }
    } catch (error) {
      if (this.currentSpinner) {
        this.currentSpinner.stop();
        this.currentSpinner = null;
      }
      this.isAgentRunning = false;
      throw error;
    }
  }

  async promptUser() {
    if (this.isAgentRunning) {
      return null; // Don't prompt while agent is running
    }

    try {
      const answer = await inquirer.prompt([
        {
          type: "input",
          name: "prompt",
          message: chalk.cyan("You:"),
          validate: (input) => {
            if (input.trim() === "") {
              return "Please enter a prompt";
            }
            return true;
          },
        },
      ]);

      return answer.prompt.trim();
    } catch (error) {
      if (error.name === "ExitPromptError") {
        return "exit";
      }
      throw error;
    }
  }

  async run() {
    this.displayWelcome();

    while (true) {
      try {
        const prompt = await this.promptUser();

        if (
          !prompt ||
          prompt.toLowerCase() === "exit" ||
          prompt.toLowerCase() === "quit"
        ) {
          console.log(chalk.yellow("\n👋 Goodbye!"));
          process.exit(0);
        }

        console.log(chalk.cyan("\n🚀 Starting agent...\n"));

        await this.executeAgent(prompt);

      } catch (error) {
        console.error(chalk.red.bold("\n💥 Agent Error:"));
        console.error(chalk.red("   Message: ") + error.message);
        if (error.stack) {
          console.error(chalk.red("   Stack: ") + chalk.gray(error.stack.split('\n').slice(1, 3).join('\n')));
        }
        console.log(chalk.yellow("\n🔄 Ready for your next prompt!\n"));
      }
    }
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let provider = "anthropic"; // default

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--provider" && i + 1 < args.length) {
      const providerArg = args[i + 1];
      if (providerArg === "anthropic" || providerArg === "openai" || providerArg === "together") {
        provider = providerArg;
      } else {
        console.error("Error: provider must be 'anthropic', 'openai', or 'together'");
        process.exit(1);
      }
      i++; // Skip the next argument
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log("Usage: node index.js [--provider <provider>]");
      console.log("  --provider: AI provider to use: anthropic, openai, or together (default: anthropic)");
      process.exit(0);
    }
  }

  return { provider };
}

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  console.log(chalk.yellow("\n\n👋 Goodbye!"));
  process.exit(0);
});

// Start the chat
const { provider } = parseArgs();
const chat = new AgentChat(provider);
chat.run().catch(console.error);
