#!/usr/bin/env node

import { query } from '../dist/index.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import process from 'process';


class AgentChat {
  constructor() {
    this.isAgentRunning = false;
    this.lastTodos = null;
    this.currentSpinner = null;
  }

  displayWelcome() {
    console.log(boxen(
      chalk.cyan.bold('🤖 Headless Agent Chat Interface') + '\n\n' +
      chalk.gray('Type your prompts to interact with the agent.\n') +
      chalk.gray('Type "exit" or "quit" to leave.'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan'
      }
    ));
  }

  formatAgentOutput(part) {
    switch (part.type) {
      case 'text':
        return chalk.white('💬 ') + part.text;
      
      case 'reasoning':
        return chalk.yellow('🧠 ') + chalk.yellow(part.text);
      
      case 'tool-call':
        let toolDescription = chalk.blue.bold(part.toolName);
        if (part.toolName === 'Edit') {
          toolDescription += chalk.gray(` (${part.args.file}: "${part.args.find}" → "${part.args.replace}")`);
        } else if (part.toolName === 'MultiEdit') {
          toolDescription += chalk.gray(` (${part.args.file}: ${part.args.edits.length} edits)`);
        }
        return chalk.blue('🔧 ') + toolDescription;
      
      case 'tool-result':
        let resultMessage = `${part.toolName} completed`;
        if (part.toolName === 'Edit' || part.toolName === 'MultiEdit') {
          resultMessage += part.result.ok ? ' successfully' : ' with errors';
        }
        return chalk.green('✅ ') + chalk.gray(resultMessage);
      
      case 'tool-error':
        return chalk.red('❌ ') + chalk.red.bold(part.toolName) + 
               chalk.red(`: ${part.error}`);
      
      case 'todos':
        if (part.todos && part.todos.length > 0) {
          this.lastTodos = part.todos;
          return chalk.magenta('📋 Todos Updated:\n') + 
            part.todos.map(todo => {
              const statusIcon = todo.status === 'completed' ? '✅' : 
                               todo.status === 'in_progress' ? '🔄' : '⏳';
              return `  ${statusIcon} ${todo.description}`;
            }).join('\n');
        }
        return '';
      
      case 'completed':
        this.lastTodos = part.todos; // Save completed todos
        return ''; // Don't show completion message
      
      case 'finish':
        return chalk.blue('🏁 ') + chalk.blue('Child session finished') +
               chalk.gray(` (${part.inputTokens} input, ${part.outputTokens} output tokens)`);
      
      case 'error':
        return chalk.red('💥 ') + chalk.red.bold('Session Error: ') + 
               chalk.red(part.error);
      
      default:
        return chalk.gray('📝 ') + JSON.stringify(part, null, 2);
    }
  }

  async executeAgent(prompt) {
    try {
      this.isAgentRunning = true;
      
      // Prepare todos from previous session if available
      const todos = this.lastTodos && this.lastTodos.length > 0 
        ? this.lastTodos
            .filter(todo => todo.status !== 'completed')
            .map(todo => ({
              description: todo.description,
              context: todo.context || 'Continued from previous session',
              status: todo.status === 'in_progress' ? 'in_progress' : 'pending'
            }))
        : undefined;

      this.currentSpinner = ora('🤖 Agent is thinking...').start();
      let hasOutput = false;

      // Use the SDK query function
      for await (const part of query({
        prompt,
        workingDirectory: process.cwd(),
        maxSteps: 50,
        todos
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
      }

      this.isAgentRunning = false;
      
      if (!hasOutput) {
        console.log(chalk.green('✨ Agent completed successfully (no output)'));
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
          type: 'input',
          name: 'prompt',
          message: chalk.cyan('You:'),
          validate: (input) => {
            if (input.trim() === '') {
              return 'Please enter a prompt';
            }
            return true;
          }
        }
      ]);

      return answer.prompt.trim();
    } catch (error) {
      if (error.name === 'ExitPromptError') {
        return 'exit';
      }
      throw error;
    }
  }

  async run() {
    this.displayWelcome();

    while (true) {
      try {
        const prompt = await this.promptUser();
        
        if (!prompt || prompt.toLowerCase() === 'exit' || prompt.toLowerCase() === 'quit') {
          console.log(chalk.yellow('\n👋 Goodbye!'));
          process.exit(0);
        }

        console.log(chalk.cyan('\n🚀 Starting agent...\n'));
        
        await this.executeAgent(prompt);
        
        console.log(chalk.green('\n✅ Agent finished. Ready for your next prompt!\n'));
        
      } catch (error) {
        console.error(chalk.red('\n❌ Error:'), error.message);
        console.log(chalk.yellow('Ready for your next prompt!\n'));
      }
    }
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Goodbye!'));
  process.exit(0);
});

// Start the chat
const chat = new AgentChat();
chat.run().catch(console.error);