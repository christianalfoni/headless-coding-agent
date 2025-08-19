#!/usr/bin/env node

import { query } from "../dist/index.js";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import boxen from "boxen";
import process from "process";
import fs from "fs";

class AgentChat {
  constructor() {
    this.isAgentRunning = false;
    this.lastTodos = null;
    this.currentSpinner = null;
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
          chalk.gray('Type "exit" or "quit" to leave.'),
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
        let resultMessage = `${part.toolName} completed`;
        if (part.toolName === "write_todos") {
          const todoCount = part.result.todos ? part.result.todos.length : 0;
          resultMessage += ` successfully (${todoCount} todos)`;
          // Update the current todos
          if (part.result.todos) {
            this.lastTodos = part.result.todos;
          }
        } else if (part.toolName === "bash") {
          const exitCode = part.result.exitCode;
          resultMessage +=
            exitCode === 0 ? " successfully" : ` with exit code ${exitCode}`;
        } else if (part.toolName === "str_replace_based_edit_tool") {
          resultMessage += part.result.includes("Error:")
            ? " with errors"
            : " successfully";
        }
        return chalk.green("✅ ") + chalk.gray(resultMessage);

      case "tool-error":
        return (
          chalk.red("❌ ") +
          chalk.red.bold(part.toolName) +
          chalk.red(`: ${part.error}`)
        );

      case "todos":
        if (part.todos && part.todos.length > 0) {
          this.lastTodos = part.todos;
          return (
            chalk.magenta("📋 Todos Updated:\n") +
            part.todos
              .map((todo) => {
                const statusIcon =
                  todo.status === "completed"
                    ? "✅"
                    : todo.status === "in_progress"
                    ? "🔄"
                    : "⏳";
                return `  ${statusIcon} ${todo.description}`;
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
      for await (const part of query({
        prompt,
        // model: "openai/gpt-5-mini-2025-08-07",
        workingDirectory: process.cwd(),
        maxSteps: 200,
        todos: this.lastTodos,
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

        console.log(
          chalk.green("\n✅ Agent finished. Ready for your next prompt!\n")
        );
      } catch (error) {
        console.error(chalk.red("\n❌ Error:"), error.message);
        console.log(chalk.yellow("Ready for your next prompt!\n"));
      }
    }
  }
}

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  console.log(chalk.yellow("\n\n👋 Goodbye!"));
  process.exit(0);
});

// Start the chat
const chat = new AgentChat();
chat.run().catch(console.error);
