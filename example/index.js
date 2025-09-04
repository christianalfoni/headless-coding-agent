#!/usr/bin/env node

import { CodeSandbox } from "@codesandbox/sdk";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import boxen from "boxen";
import process from "process";
import fs from "fs";
import { execSync } from "child_process";

class AgentChat {
  constructor(provider = "together") {
    this.isAgentRunning = false;
    this.lastTodos = null;
    this.currentSpinner = null;
    this.provider = provider;
    this.lastPwd = null;
    this.logFileName = `../agent-chat-${
      new Date().toISOString().split("T")[0]
    }.log`;
    this.conversation = [];
    this.conversationFileName = `${process.cwd()}/CONVERSATION.md`;
    this.sandbox = null;
    this.client = null;
    this.serverUrl = null;
    this.sandboxInitialized = false;
    this.gitRepoInfo = this.detectGitRepo();
  }

  detectGitRepo() {
    try {
      const cwd = process.cwd();
      // Check if we're in a git repository
      execSync("git rev-parse --is-inside-work-tree", { cwd, stdio: "pipe" });

      // Get the remote origin URL
      const remoteUrl = execSync("git config --get remote.origin.url", {
        cwd,
        encoding: "utf8",
      }).trim();

      // Parse GitHub org/repo from URL
      const match = remoteUrl.match(
        /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/
      );
      if (match) {
        return {
          isGitRepo: true,
          org: match[1],
          repo: match[2],
          fullName: `${match[1]}/${match[2]}`,
        };
      }

      return { isGitRepo: true };
    } catch (error) {
      return { isGitRepo: false };
    }
  }

  logMessage(message) {
    try {
      fs.appendFileSync(this.logFileName, message + "\n\n", "utf8");
    } catch (error) {
      console.error("Failed to write to log file:", error.message);
    }
  }

  addToConversation(type, content) {
    this.conversation.push({
      type,
      content,
      timestamp: new Date().toISOString(),
    });
  }

  formatConversationAsMarkdown() {
    let markdown = `# 🤖 Agent Conversation\n\n`;
    markdown += `**Provider:** ${this.provider}\n`;
    markdown += `**Started:** ${new Date().toLocaleString()}\n\n`;
    markdown += `---\n\n`;

    for (const entry of this.conversation) {
      switch (entry.type) {
        case "user_prompt":
          markdown += `## 🧑‍💻 User\n\n${entry.content}\n\n`;
          break;
        case "agent_text":
          markdown += `## 🤖 Agent\n\n${entry.content}\n\n`;
          break;
        case "agent_reasoning":
          markdown += `### 🧠 Reasoning\n\n${entry.content}\n\n`;
          break;
        case "tool_call":
          markdown += `### 🔧 Tool Call: ${entry.content.toolName}\n\n`;
          if (entry.content.description) {
            markdown += `**Description:** ${entry.content.description}\n\n`;
          }
          if (
            entry.content.args &&
            Object.keys(entry.content.args).length > 0
          ) {
            markdown += `**Arguments:**\n\`\`\`json\n${JSON.stringify(
              entry.content.args,
              null,
              2
            )}\n\`\`\`\n\n`;
          }
          break;
        case "tool_result":
          if (entry.content.error) {
            markdown += `### ❌ Tool Error\n\n\`\`\`\n${entry.content.error}\n\`\`\`\n\n`;
          } else if (entry.content.success) {
            markdown += `### ✅ Tool Success\n\n${entry.content.success}\n\n`;
          }
          break;
        case "todos":
          markdown += `### 📋 Todos Updated\n\n`;
          for (const todo of entry.content) {
            const statusIcon =
              todo.status === "completed"
                ? "✅"
                : todo.status === "in_progress"
                ? "🔄"
                : "⏳";
            markdown += `- ${statusIcon} ${todo.description}\n`;
          }
          markdown += `\n`;
          break;
        case "completion":
          markdown += `### 🏁 Completion Summary\n\n`;
          markdown += `- **Steps:** ${entry.content.stepCount}\n`;
          markdown += `- **Duration:** ${entry.content.duration}\n`;
          markdown += `- **Tokens:** ${entry.content.tokens}\n`;
          if (entry.content.cost) {
            markdown += `- **Cost:** ${entry.content.cost}\n`;
          }
          markdown += `\n`;
          break;
        case "error":
          markdown += `### 💥 Error\n\n\`\`\`\n${entry.content}\n\`\`\`\n\n`;
          break;
      }
    }

    return markdown;
  }

  saveConversation() {
    try {
      const markdown = this.formatConversationAsMarkdown();
      fs.writeFileSync(this.conversationFileName, markdown, "utf8");
    } catch (error) {
      console.error("Failed to write conversation file:", error.message);
    }
  }

  getToolDescription(part) {
    if (part.toolName === "write_todos") {
      const todoCount = part.args.todos ? part.args.todos.length : 0;
      return `updating ${todoCount} todos`;
    } else if (part.toolName === "bash") {
      if (part.args.restart) {
        return `restart shell`;
      } else if (part.args.command) {
        return part.args.command;
      }
    } else if (part.toolName === "str_replace_based_edit_tool") {
      const command = part.args.command;
      const path = part.args.path;
      if (command === "view") {
        if (part.args.view_range) {
          return `${command} ${path}:${part.args.view_range[0]}-${part.args.view_range[1]}`;
        } else {
          return `${command} ${path}`;
        }
      } else if (command === "create") {
        return `${command} ${path}`;
      } else if (command === "str_replace") {
        return `${command} in ${path}`;
      } else if (command === "insert") {
        return `${command} in ${path}:${part.args.insert_line}`;
      } else {
        return `${command} ${path}`;
      }
    } else if (part.toolName === "web_fetch") {
      return `fetch ${part.args.url}`;
    } else if (part.toolName === "web_search") {
      return `search "${part.args.query}"`;
    }
    return "";
  }

  async initializeSandbox() {
    try {
      const apiKey = process.env.CSB_API_KEY;
      if (!apiKey) {
        throw new Error("CSB_API_KEY environment variable is required");
      }

      this.currentSpinner = ora("🏗️  Creating CodeSandbox...").start();

      const sdk = new CodeSandbox(apiKey);
      this.sandbox = await sdk.sandboxes.create({
        id: "pt_Nku3d25CafCmFenFFW7FFk", // Template ID
      });

      this.currentSpinner.text = "🔗 Connecting to sandbox...";
      this.client = await this.sandbox.connect();

      this.currentSpinner.text =
        "⏳ Waiting for server to start on port 4999...";
      const port = await this.client.ports.waitForPort(4999, {
        timeoutMs: 60000,
      });
      this.serverUrl = `https://${port.host}`;

      this.currentSpinner.stop();
      this.currentSpinner = null;

      console.log(chalk.green(`✅ Sandbox ready: ${this.client.editorUrl}`));
      console.log(chalk.gray(`🌐 Server URL: ${this.serverUrl}`));

      this.sandboxInitialized = true;
      return true;
    } catch (error) {
      if (this.currentSpinner) {
        this.currentSpinner.stop();
        this.currentSpinner = null;
      }
      throw error;
    }
  }

  async makeRequest(endpoint, method = "GET", body = null) {
    const response = await fetch(`${this.serverUrl}${endpoint}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : null,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async fetchCodeSandboxAuthToken() {
    try {
      const response = await fetch(
        "https://codesandbox.io/api/v1/auth/auth-token",
        {
          method: "GET",
          headers: {
            Cookie:
              "guardian_default_token=eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJDb2RlU2FuZGJveCIsImV4cCI6MTc1ODg3Mzg2NSwiaWF0IjoxNzU2NDU0NjY1LCJpc3MiOiJDb2RlU2FuZGJveCIsImp0aSI6ImU2NzFlZjQzLTRmNzgtNDU2Yi04ZDk1LWQ0OGU1MTE3YmM1MiIsIm5iZiI6MTc1NjQ1NDY2NCwic3ViIjoiVXNlcjp1c2VyXzhwU3FuM3JmVk55VVZCOThaN0Z5bm4iLCJ0eXAiOiJyZWZyZXNoIn0.Ih6FshRg9zmZQ_0Wox95CFjlQADbAs5zN9aV0OBqdmWPrDAB7ax_zXEJqqsv86rnNx2B3akbnUBqT2MTyqfzDQ;",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch auth token: ${response.status}`);
      }

      const result = await response.json();
      return result.data.token;
    } catch (error) {
      console.error("Error fetching CodeSandbox auth token:", error);
      return null;
    }
  }

  async generateVSCodeLink() {
    if (!this.sandbox?.id) {
      return null;
    }

    try {
      const token = await this.fetchCodeSandboxAuthToken();
      if (!token) {
        return null;
      }

      const vscodeUrl = `vscode://CodeSandbox-io.codesandbox-projects/sandbox/${
        this.sandbox.id
      }?token=${encodeURIComponent(token)}`;
      return vscodeUrl;
    } catch (error) {
      console.error("Error generating VSCode link:", error);
      return null;
    }
  }

  async startQuery(prompt, apiKey) {
    const requestBody = {
      prompt,
      apiKey,
      provider: this.provider,
      maxSteps: 200,
      workingDirectory: "/project/workspace",
    };

    // Add GitHub token if available
    if (process.env.GITHUB_TOKEN) {
      requestBody.githubToken = process.env.GITHUB_TOKEN;
    }

    // Add git repository info if available
    if (this.gitRepoInfo) {
      requestBody.gitRepoInfo = this.gitRepoInfo;
    }

    return this.makeRequest("/query", "POST", requestBody);
  }

  async pollMessages(since = null) {
    const endpoint = since ? `/messages?since=${since}` : "/messages";
    return this.makeRequest(endpoint);
  }

  convertSandboxMessage(message) {
    // The server stores messages in format: { timestamp, message }
    // Where message is the actual agent message object

    // Return the actual message object from the server
    return message.message;
  }

  displayWelcome() {
    let welcomeMessage =
      chalk.cyan.bold("🤖 Headless Agent Chat Interface") +
      "\n" +
      chalk.magenta.bold("🏗️  Using CodeSandbox") +
      "\n\n";

    if (this.gitRepoInfo.isGitRepo && this.gitRepoInfo.fullName) {
      welcomeMessage += chalk.green(
        `📂 Repository: ${this.gitRepoInfo.fullName}\n`
      );
    }

    welcomeMessage +=
      chalk.gray("Type your prompts to interact with the agent.\n") +
      chalk.gray('Type "exit" or "quit" to leave.\n') +
      chalk.gray(`Using provider: ${this.provider}\n`) +
      chalk.gray(`Conversation will be saved to: CONVERSATION.md`);

    console.log(
      boxen(welcomeMessage, {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "cyan",
      })
    );
  }

  truncateInput(input, maxLines = 4) {
    if (input == null) {
      return "";
    }
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
        this.addToConversation("agent_text", part.text);
        return chalk.white("💬 ") + part.text;

      case "reasoning":
        this.addToConversation("agent_reasoning", part.text);
        return chalk.gray("🧠 ") + chalk.gray(part.text);

      case "tool-call":
        this.addToConversation("tool_call", {
          toolName: part.toolName,
          args: part.args,
          description: this.getToolDescription(part),
        });

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
          this.addToConversation("tool_result", {
            success: `todos updated (${todoCount} todos)`,
          });
          return (
            chalk.green("✅ ") +
            chalk.gray(`todos updated (${todoCount} todos)`)
          );
        } else if (part.toolName === "bash") {
          const exitCode = part.result.exitCode;
          const stderr = part.result.stderr;
          const stdout = part.result.stdout;

          if (exitCode !== 0) {
            let errorMsg = `bash failed with exit code ${exitCode}`;
            if (stderr && stderr.trim()) {
              errorMsg += `\nstderr: ${stderr.trim()}`;
            }
            if (stdout && stdout.trim()) {
              errorMsg += `\nstdout: ${stdout.trim()}`;
            }
            this.addToConversation("tool_result", { error: errorMsg });

            let displayMsg = chalk.red(
              `bash failed with exit code ${exitCode}`
            );
            if (stderr && stderr.trim()) {
              displayMsg +=
                "\n" + chalk.red("   stderr: ") + chalk.gray(stderr.trim());
            }
            if (stdout && stdout.trim()) {
              displayMsg +=
                "\n" + chalk.red("   stdout: ") + chalk.gray(stdout.trim());
            }
            return chalk.red("❌ ") + displayMsg;
          }
        } else if (part.toolName === "str_replace_based_edit_tool") {
          if (part.result.includes("Error:")) {
            this.addToConversation("tool_result", {
              error: `edit failed: ${part.result}`,
            });
            return (
              chalk.red("❌ ") +
              chalk.red("edit failed: ") +
              chalk.gray(part.result)
            );
          }
        }
        // Return empty string for successful tool results (don't show anything)
        return "";

      case "tool-error":
        this.addToConversation("tool_result", {
          error: `Tool Error (${part.toolName}): ${part.error}`,
        });
        return (
          chalk.red("❌ Tool Error: ") +
          chalk.red.bold(part.toolName) +
          "\n" +
          chalk.red("   Error: ") +
          chalk.red(part.error)
        );

      case "todos":
        if (part.todos && part.todos.length > 0) {
          this.lastTodos = part.todos;
          this.addToConversation("todos", part.todos);

          return (
            chalk.magenta("📋 Todos Updated ") +
            chalk.yellow(`(${part.reasoningEffort})`) +
            "\n" +
            part.todos
              .map((todo) => {
                const statusIcon =
                  todo.status === "completed"
                    ? "✅"
                    : todo.status === "in_progress"
                    ? "🔄"
                    : "⏳";

                return (
                  `  ${statusIcon} ` +
                  chalk.yellow(`(${todo.reasoningEffort})`) +
                  ` ${todo.description}`
                );
              })
              .join("\n")
          );
        }
        return "";

      case "completed":
        this.lastTodos = part.todos; // Save completed todos
        const totalSeconds = Math.floor(part.durationMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const duration =
          minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

        let costInfo = "";
        if (part.totalCostDollars !== undefined) {
          costInfo = `, $${part.totalCostDollars.toFixed(4)}`;
        }

        this.addToConversation("completion", {
          stepCount: part.stepCount,
          duration: duration,
          tokens: `${part.inputTokens + part.outputTokens} tokens (${
            part.inputTokens
          } in, ${part.outputTokens} out)`,
          cost:
            part.totalCostDollars !== undefined
              ? `$${part.totalCostDollars.toFixed(4)}`
              : undefined,
        });

        // Generate VSCode link asynchronously and display it
        this.generateVSCodeLink()
          .then((vscodeUrl) => {
            if (vscodeUrl) {
              // Use OSC 8 hyperlink escape sequence to make clickable text
              const linkText = "Open in VSCode";
              const clickableLink = `\u001b]8;;${vscodeUrl}\u001b\\${linkText}\u001b]8;;\u001b\\`;
              console.log(chalk.blue("🔗 ") + clickableLink);
            }
          })
          .catch((error) => {
            console.error("Error generating VSCode link:", error);
          });

        return (
          chalk.green("🏁 ") +
          chalk.gray(
            `Completed in ${part.stepCount} steps, ${
              part.inputTokens + part.outputTokens
            } tokens (${part.inputTokens} in, ${
              part.outputTokens
            } out), ${duration}${costInfo}`
          )
        );

      case "error":
        this.addToConversation("error", part.error);
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

      // Initialize sandbox if not already done
      if (!this.sandboxInitialized) {
        await this.initializeSandbox();
      }

      // Add user prompt to conversation
      this.addToConversation("user_prompt", prompt);

      // Get API key for the chosen provider
      const apiKeyEnvVar =
        this.provider === "anthropic"
          ? "ANTHROPIC_API_KEY"
          : this.provider === "openai"
          ? "OPENAI_API_KEY"
          : "TOGETHER_API_KEY";
      const apiKey = process.env[apiKeyEnvVar];

      if (!apiKey) {
        throw new Error(`${apiKeyEnvVar} environment variable is required`);
      }

      this.currentSpinner = ora("🤖 Starting agent in sandbox...").start();

      // Start the query in the sandbox
      await this.startQuery(prompt, apiKey);

      this.currentSpinner.stop();
      this.currentSpinner = null;

      console.log(chalk.green("✅ Query started in sandbox"));
      console.log(); // Add line break

      // Poll for messages
      let lastTimestamp = null;
      let hasOutput = false;
      let isCompleted = false;

      while (!isCompleted) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

        try {
          const response = await this.pollMessages(lastTimestamp);

          if (response.messages && response.messages.length > 0) {
            hasOutput = true;

            for (const message of response.messages) {
              // Convert sandbox message format to the format expected by formatAgentOutput
              const formattedMessage = this.convertSandboxMessage(message);
              const formatted = this.formatAgentOutput(formattedMessage);
              if (formatted) {
                console.log(formatted);
                console.log(); // Add line break between messages
              }

              // Log the raw JSON message
              this.logMessage(JSON.stringify(message, null, 2));
              lastTimestamp = message.timestamp;
            }
          }

          // Check if the session is completed or errored
          if (response.status === "completed" || response.status === "error") {
            isCompleted = true;

            if (response.status === "error") {
              console.log(
                chalk.red("❌ Session completed with error: " + response.error)
              );
              this.addToConversation("error", response.error);
            }
          }
        } catch (pollError) {
          console.error(
            chalk.red("Error polling messages:", pollError.message)
          );
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait longer on error
        }
      }

      this.isAgentRunning = false;

      if (!hasOutput) {
        console.log(chalk.green("✨ Agent completed successfully (no output)"));
      }

      // Save conversation after each agent execution
      this.saveConversation();
      console.log(chalk.gray("📝 Conversation saved to CONVERSATION.md"));
    } catch (error) {
      if (this.currentSpinner) {
        this.currentSpinner.stop();
        this.currentSpinner = null;
      }
      this.isAgentRunning = false;

      // Add error to conversation and save
      this.addToConversation("error", error.message);
      this.saveConversation();

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
          if (this.client) {
            await this.client.disconnect();
          }
          process.exit(0);
        }

        console.log(chalk.cyan("\n🚀 Starting agent...\n"));

        await this.executeAgent(prompt);
      } catch (error) {
        console.error(chalk.red.bold("\n💥 Agent Error:"));
        console.error(chalk.red("   Message: ") + error.message);
        if (error.message.includes("CSB_API_KEY")) {
          console.error(
            chalk.yellow(
              "   💡 Get your API key at: https://codesandbox.io/t/api"
            )
          );
        }
        if (error.stack) {
          console.error(
            chalk.red("   Stack: ") +
              chalk.gray(error.stack.split("\n").slice(1, 3).join("\n"))
          );
        }
        console.log(chalk.yellow("\n🔄 Ready for your next prompt!\n"));
      }
    }
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let provider = "together"; // default

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--provider" && i + 1 < args.length) {
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
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log("Usage: node index.js [--provider <provider>]");
      console.log(
        "  --provider: AI provider to use: anthropic, openai, or together (default: together)"
      );
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
