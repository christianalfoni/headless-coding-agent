#!/usr/bin/env node

import { spawn } from 'child_process';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

  formatAgentOutput(data) {
    try {
      const parsed = JSON.parse(data);
      
      switch (parsed.type) {
        case 'text':
          return chalk.white('💬 ') + parsed.content;
        
        case 'tool_use':
          return chalk.blue('🔧 ') + chalk.blue.bold(parsed.name) + 
                 (parsed.parameters ? chalk.gray(` ${JSON.stringify(parsed.parameters, null, 2)}`) : '');
        
        case 'tool_result':
          const isError = parsed.isError;
          const prefix = isError ? chalk.red('❌ ') : chalk.green('✅ ');
          const content = typeof parsed.content === 'string' ? 
            parsed.content : JSON.stringify(parsed.content, null, 2);
          
          // Truncate very long outputs
          const truncated = content.length > 500 ? 
            content.substring(0, 500) + chalk.gray('... (truncated)') : content;
          
          return prefix + chalk.gray(truncated);
        
        case 'todos':
          if (parsed.todos && parsed.todos.length > 0) {
            this.lastTodos = parsed.todos;
            return chalk.magenta('📋 Todos Updated:\n') + 
              parsed.todos.map(todo => {
                const statusIcon = todo.status === 'completed' ? '✅' : 
                                 todo.status === 'in_progress' ? '🔄' : '⏳';
                return `  ${statusIcon} ${todo.content}`;
              }).join('\n');
          }
          return '';
        
        case 'session_complete':
          return chalk.green.bold('✨ Agent session completed!');
        
        default:
          return chalk.gray('📝 ') + JSON.stringify(parsed, null, 2);
      }
    } catch (e) {
      // If not JSON, just return the raw data
      return chalk.gray(data);
    }
  }

  async executeAgent(prompt) {
    return new Promise((resolve, reject) => {
      this.isAgentRunning = true;
      
      // Build command args
      const agentPath = join(__dirname, '..', 'dist', 'cli.js');
      const args = ['--prompt', prompt];
      
      // Add todos from previous session if available
      if (this.lastTodos && this.lastTodos.length > 0) {
        // Convert todos to expected format
        const todosForAgent = this.lastTodos
          .filter(todo => todo.status !== 'completed')
          .map(todo => ({
            description: todo.content,
            status: todo.status === 'in_progress' ? 'in_progress' : 'pending'
          }));
        
        if (todosForAgent.length > 0) {
          args.push('--todos', JSON.stringify(todosForAgent));
        }
      }

      const agent = spawn('node', [agentPath, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      this.currentSpinner = ora('🤖 Agent is thinking...').start();
      let hasOutput = false;

      agent.stdout.on('data', (data) => {
        if (this.currentSpinner) {
          this.currentSpinner.stop();
          this.currentSpinner = null;
          hasOutput = true;
        }

        const lines = data.toString().split('\n').filter(line => line.trim());
        for (const line of lines) {
          const formatted = this.formatAgentOutput(line.trim());
          if (formatted) {
            console.log(formatted);
          }
        }
      });

      agent.stderr.on('data', (data) => {
        if (this.currentSpinner) {
          this.currentSpinner.stop();
          this.currentSpinner = null;
        }
        console.error(chalk.red('Error: ') + data.toString());
      });

      agent.on('close', (code) => {
        if (this.currentSpinner) {
          this.currentSpinner.stop();
          this.currentSpinner = null;
        }
        
        this.isAgentRunning = false;
        
        if (code === 0) {
          if (!hasOutput) {
            console.log(chalk.green('✨ Agent completed successfully (no output)'));
          }
          resolve();
        } else {
          reject(new Error(`Agent exited with code ${code}`));
        }
      });

      agent.on('error', (err) => {
        if (this.currentSpinner) {
          this.currentSpinner.stop();
          this.currentSpinner = null;
        }
        this.isAgentRunning = false;
        reject(err);
      });
    });
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