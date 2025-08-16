#!/usr/bin/env node

import { query } from './index';

function parseArgs() {
  const args = process.argv.slice(2);
  let prompt = '';
  let format = false;
  let maxSteps: number | undefined;
  
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
    }
  }
  
  if (!prompt) {
    console.error('Usage: agent -p "your prompt here" [-f] [--maxSteps <number>]');
    console.error('  -p: prompt to send to the agent');
    console.error('  -f: format JSON output (pretty print)');
    console.error('  --maxSteps: maximum number of AI steps (default: unlimited)');
    process.exit(1);
  }
  
  return { prompt, format, maxSteps };
}

async function main() {
  try {
    const { prompt, format, maxSteps } = parseArgs();
    
    const stream = query({
      prompt,
      workingDirectory: process.cwd(),
      maxSteps
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