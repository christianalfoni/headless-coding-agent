# Command-Line Tools

This directory contains tools that wrap standard Unix/Linux command-line utilities. Each tool is bound to a specific command and takes arguments/flags as input.

## Universal Input Schema

All tools use the same simple input schema:

```typescript
const inputSchema = z.object({
  input: z.string().describe("Arguments and flags for the [command] command")
});
```

Each tool is essentially a wrapper around a specific command-line utility.

## Available Tools

- **bashTool**: Execute `bash` commands and scripts
- **lsTool**: List directory contents using `ls` command  
- **grepTool**: Search text patterns using `grep` command
- **globTool**: Find files using `find` command (for glob-like functionality)
- **readTool**: Read files using `cat` command
- **editTool**: Edit files using `sed` command
- **writeTodosTool**: Manage todos (special case with structured data)

## Usage Examples

```typescript
import { lsTool, grepTool, readTool } from './tools';

// List files with details
await lsTool.execute({ input: "-la /path/to/directory" });

// Search for pattern in files
await grepTool.execute({ input: "-r 'function.*test' src/" });

// Read a file
await readTool.execute({ input: "/path/to/file.txt" });

// Find files by pattern
await globTool.execute({ input: ". -name '*.js'" });
```

Each tool executes its bound command with the provided arguments, returning the standard output, errors, and success status.