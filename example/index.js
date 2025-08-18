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
    if (typeof input !== 'string') {
      input = JSON.stringify(input);
    }
    const lines = input.split('\n');
    if (lines.length > maxLines) {
      const truncated = lines.slice(0, maxLines).join('\n');
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
        return chalk.yellow("🧠 ") + chalk.yellow(part.text);

      case "tool-call":
        let toolDescription = chalk.blue.bold(part.toolName);
        if (part.toolName === "Edit") {
          const findText = this.truncateInput(part.args.find);
          const replaceText = this.truncateInput(part.args.replace);
          toolDescription += chalk.gray(
            ` (${part.args.file}: "${findText}" → "${replaceText}")`
          );
        } else if (part.toolName === "MultiEdit") {
          toolDescription += chalk.gray(
            ` (${part.args.file}: ${part.args.edits.length} edits)`
          );
        } else if (part.toolName === "Bash") {
          const command = this.truncateInput(part.args.bashCommand);
          toolDescription += chalk.gray(` (${command})`);
        } else if (part.toolName === "Read") {
          const args = this.truncateInput(part.args.catArguments);
          toolDescription += chalk.gray(` (${args})`);
        } else if (part.toolName === "Write") {
          toolDescription += chalk.gray(` (${part.args.filePath})`);
        } else if (part.toolName === "Ls") {
          const args = this.truncateInput(part.args.lsArguments);
          toolDescription += chalk.gray(` (${args})`);
        } else if (part.toolName === "Glob") {
          const args = this.truncateInput(part.args.globArguments);
          toolDescription += chalk.gray(` (${args})`);
        } else if (part.toolName === "Grep") {
          const args = this.truncateInput(part.args.grepArguments);
          toolDescription += chalk.gray(` (${args})`);
        } else if (part.toolName === "WebFetch") {
          toolDescription += chalk.gray(` (${part.args.url})`);
        } else if (part.toolName === "WebSearch") {
          toolDescription += chalk.gray(` ("${part.args.query}")`);
        }
        return chalk.blue("🔧 ") + toolDescription;

      case "tool-result":
        let resultMessage = `${part.toolName} completed`;
        if (part.toolName === "Edit" || part.toolName === "MultiEdit") {
          resultMessage += part.result.ok ? " successfully" : " with errors";
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
        return ""; // Don't show completion message

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
        // model: "together/openai/gpt-oss-120b",
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
