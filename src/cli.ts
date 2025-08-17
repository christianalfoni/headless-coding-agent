#!/usr/bin/env node

import { query } from './index';

function parseArgs() {
  const args = process.argv.slice(2);
  let prompt = '';
  let format = false;
  let maxSteps: number | undefined;
  let initialTodos: { description: string; status?: "pending" | "in_progress" | "completed" }[] | undefined;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-p' && i + 1 < args.length) {
      prompt = args[i + 1];
      i++; // Skip the next argument
    } else if (args[i] === '-f') {
      format = true;
    } else if (args[i] === '--maxSteps' && i + 1 < args.length) {
      maxSteps = parseInt(args[i + 1], 10);
      if (isNaN(maxSteps) || maxSteps <= 0) {
        console.error('Error: maxSteps must be a positive number');
        process.exit(1);
      }
      i++; // Skip the next argument
    } else if (args[i] === '--initialTodos' && i + 1 < args.length) {
      try {
        initialTodos = JSON.parse(args[i + 1]);
        if (!Array.isArray(initialTodos)) {
          console.error('Error: initialTodos must be a JSON array');
          process.exit(1);
        }
        // Validate structure
        for (const todo of initialTodos) {
          if (!todo.description) {
            console.error('Error: Each todo must have a "description" field');
            process.exit(1);
          }
          if (todo.status && !["pending", "in_progress", "completed"].includes(todo.status)) {
            console.error('Error: Todo status must be "pending", "in_progress", or "completed"');
            process.exit(1);
          }
        }
      } catch (error) {
        console.error('Error: initialTodos must be valid JSON');
        process.exit(1);
      }
      i++; // Skip the next argument
    }
  }
  
  if (!prompt) {
    console.error('Usage: agent -p "your prompt here" [-f] [--maxSteps <number>] [--initialTodos <json>]');
    console.error('  -p: prompt to send to the agent');
    console.error('  -f: format JSON output (pretty print)');
    console.error('  --maxSteps: maximum number of AI steps (default: unlimited)');
    console.error('  --initialTodos: JSON array of initial todos for session continuation');
    process.exit(1);
  }
  
  return { prompt, format, maxSteps, initialTodos };
}

async function main() {
  try {
    const { prompt, format, maxSteps, initialTodos } = parseArgs();
    
    const stream = query({
      prompt,
      workingDirectory: process.cwd(),
      maxSteps,
      initialTodos
    });
    
    for await (const part of stream) {
      if (format) {
        console.log(JSON.stringify(part, null, 2));
      } else {
        console.log(JSON.stringify(part));
      }
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();