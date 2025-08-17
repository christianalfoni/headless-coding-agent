# Headless Coding Agent

A headless AI coding agent that autonomously executes development tasks through streaming JSON output. Use any model to plan, implement, and manage complex coding workflows while providing full transparency through structured output.

## ⚠️ Security Notice

**This tool is designed to run in an isolated sandbox environment only.** It executes arbitrary bash commands, modifies files, and makes network requests. Never run this tool:

- On production systems
- With access to sensitive data or credentials
- In environments with important files that aren't backed up
- On your main development machine without proper isolation

**Recommended environments:**

- Docker containers
- Virtual machines
- Isolated development sandboxes
- Dedicated testing environments

## Features

- **Autonomous Task Execution**: Breaks down complex requests into manageable todos and executes them systematically
- **Session Management**: Hierarchical session system with parent-child relationships for complex task delegation
- **Tool Integration**: Comprehensive file system operations, web search, and bash command execution
- **Streaming JSON Output**: Real-time progress updates through structured JSON messages
- **Session Continuation**: Resume interrupted sessions with todo state preservation

## Use as Node.js SDK

### Installation

```bash
npm install headless-code
```

### Basic Usage

```javascript
import { query } from "headless-code";

async function main() {
  const options = {
    prompt: "Fix all TypeScript errors in this project",
    workingDirectory: process.cwd(),
    maxSteps: 50,
    model: "anthropic/claude-3-5-sonnet-20241022", // Optional
  };

  for await (const part of query(options)) {
    console.log(JSON.stringify(part, null, 2));
  }
}
```

### QueryOptions Interface

```typescript
interface QueryOptions {
  prompt: string; // Task description
  workingDirectory: string; // Path to work in
  maxSteps?: number; // Maximum AI steps (optional)
  model?: string; // AI model to use (optional)
  todos?: {
    // Resume with existing todos
    description: string;
    context: string; // Information on why this todo was created
    status?: "pending" | "in_progress" | "completed";
  }[];
}
```

### Example with Session Continuation

```javascript
// Start a session
const todos = [
  {
    description: "Analyze existing code structure",
    context: "Initial analysis required to understand current architecture",
    status: "completed",
    summary: "Found 15 components with consistent TypeScript patterns",
  },
  {
    description: "Implement authentication system",
    context: "Core feature needed for user management functionality",
  },
  {
    description: "Write unit tests",
    context: "Quality assurance needed for reliable deployment",
  },
];

for await (const part of query({
  prompt: "Build a user management system",
  workingDirectory: "./my-app",
  todos,
})) {
  if (part.type === "completed") {
    console.log("Final todos:", part.todos);
  }
}
```

## Use as CLI

### Installation

```bash
npm install -g headless-code
# or
npx headless-code --prompt "your prompt here"
```

### Basic Usage

```bash
# Simple task execution
agent --prompt "Add TypeScript to this JavaScript project"

# With formatted output
agent --prompt "Refactor this component to use hooks" --format

# With step limit
agent --prompt "Debug the authentication flow" --maxSteps 20

# With specific model
agent --prompt "Refactor this code" --model "openai/gpt-4o"

# Resume session with todos
agent --prompt "Continue implementation" --todos '[{"description":"Setup database schema","context":"Database foundation needed for user data","status":"completed"},{"description":"Implement API endpoints","context":"Backend services required for frontend integration"}]'
```

### CLI Options

- `--prompt <string>`: Task description (required)
- `--format`: Pretty print JSON output
- `--maxSteps <number>`: Maximum AI steps to execute
- `--model <string>`: AI model to use (default: anthropic/claude-3-5-sonnet-20241022)
- `--todos <json>`: JSON array of initial todos for continuation

## Supported AI Models

### Available Providers

The agent supports multiple AI providers through a unified interface. Specify models using the format `provider/model-name`:

#### Anthropic

- **Environment Variable**: `ANTHROPIC_API_KEY`
- **Example**: `agent --prompt "Fix bugs" --model "anthropic/claude-3-5-sonnet-20241022"`

#### OpenAI

- **Environment Variable**: `OPENAI_API_KEY`
- **Example**: `agent --prompt "Code review" --model "openai/gpt-4o"`

#### Google

- **Environment Variable**: `GOOGLE_GENERATIVE_AI_API_KEY`
- **Example**: `agent --prompt "Analyze data" --model "google/gemini-1.5-pro"`

#### Mistral

- **Environment Variable**: `MISTRAL_API_KEY`
- **Example**: `agent --prompt "Complex task" --model "mistral/mistral-large-latest"`

#### xAI (Grok)

- **Environment Variable**: `XAI_API_KEY`
- **Example**: `agent --prompt "Creative coding" --model "xai/grok-beta"`

#### Together AI

- **Environment Variable**: `TOGETHER_AI_API_KEY`
- **Example**: `agent --prompt "OSS project" --model "together/meta-llama/Llama-2-70b-chat-hf"`

### Setting Up API Keys

Create a `.env` file or set environment variables:

```bash
# Choose one or more providers
ANTHROPIC_API_KEY=your_anthropic_key_here
OPENAI_API_KEY=your_openai_key_here
GOOGLE_GENERATIVE_AI_API_KEY=your_google_key_here
MISTRAL_API_KEY=your_mistral_key_here
XAI_API_KEY=your_xai_key_here
TOGETHER_AI_API_KEY=your_together_key_here
```

### Using Models in Code

```javascript
import { query } from "headless-code";

// Use different providers for different tasks
const options = {
  prompt: "Implement authentication system",
  workingDirectory: "./project",
  model: "openai/gpt-4o", // or any supported model
};

for await (const part of query(options)) {
  console.log(part);
}
```

## Sessions and Execution

### Session Hierarchy

The system uses a hierarchical session model:

```
Root Session (user prompt)
├── Todo Evaluation Session
├── Todo Execution Session 1
│   └── Child Session (if delegation needed)
└── Todo Execution Session 2
    ├── Child Session A
    └── Child Session B
```

### Execution Flow

1. **Todo Evaluation**: AI analyzes the prompt and creates/updates todo list
2. **Task Delegation**: For multiple todos, creates child sessions for each
3. **Todo Execution**: Individual todos executed with available tools
4. **Summarization**: Final results compiled and presented

### Session Environment

Each session operates within a `SessionEnvironment`:

```typescript
class SessionEnvironment {
  workingDirectory: string; // Current working directory
  gitStatus?: unknown; // Git repository status
  model: AnthropicModel; // AI model instance
  maxSteps?: number; // Step limit
}
```

## System Prompts

### Todo Evaluation Prompt

Used in `Session.evaluateTodos()`:

- **Purpose**: Analyze completed work and determine remaining tasks
- **Context**: Working directory, completed todos, pending todos
- **Behavior**: Creates consolidated todos, prefers broader tasks over granular ones
- **Tool Access**: Only `WriteTodos` tool

### Todo Execution Prompt

Used in `Session.executeTodo()`:

- **Purpose**: Execute a specific todo using available tools
- **Context**: Working directory, specific todo description
- **Behavior**: Focus on efficient task completion, avoid long-running processes
- **Tool Access**: All tools (bash, read, edit, glob, grep, ls, write, multiEdit, WebFetch, WebSearch)

### Summarization Prompt

Used in `Session.summarizeTodos()`:

- **Purpose**: Provide final answer based on completed work
- **Context**: All completed todos and their results
- **Behavior**: Describe what HAS BEEN DONE using past tense
- **Tool Access**: No tools

## Message Types

### Message Architecture

All messages compose a base `SessionInfo` interface with specific message data:

```typescript
interface SessionInfo {
  sessionId: string;
  parentSessionId?: string;
}

type Message =
  | TextMessage
  | ReasoningMessage
  | TodosMessage
  | CompletedMessage
  | ToolCallMessage
  | ToolResultMessage
  | ToolErrorMessage
  | ErrorMessage;
```

### Individual Message Types

#### TextMessage

AI-generated text output:

```json
{
  "type": "text",
  "text": "I'm analyzing your TypeScript configuration...",
  "sessionId": "uuid-1234",
  "parentSessionId": "uuid-parent"
}
```

#### ReasoningMessage

AI's internal reasoning process:

```json
{
  "type": "reasoning",
  "text": "The user wants me to fix errors. I should start by running a type check.",
  "sessionId": "uuid-1234"
}
```

#### TodosMessage

Todo list updates:

```json
{
  "type": "todos",
  "todos": [
    {
      "description": "Fix TypeScript errors in src/",
      "context": "Type checking revealed errors that need fixing",
      "status": "pending"
    }
  ],
  "sessionId": "uuid-1234"
}
```

#### ToolCallMessage

Tool execution initiation:

```json
{
  "type": "tool-call",
  "toolCallId": "call_abc123",
  "toolName": "Bash",
  "args": {
    "command": "npm run typecheck",
    "description": "Check for type errors"
  },
  "sessionId": "uuid-1234"
}
```

#### ToolResultMessage

Tool execution results. The `result` field structure varies by tool:

**Bash** - Execute shell commands:

```json
{
  "type": "tool-result",
  "toolCallId": "call_abc123",
  "toolName": "Bash",
  "result": {
    "stdout": "Found 3 errors in 2 files",
    "success": false,
    "stderr": "TypeScript error messages"
  },
  "sessionId": "uuid-1234"
}
```

**Read** - Read file contents:

```json
{
  "type": "tool-result",
  "toolCallId": "call_def456",
  "toolName": "Read",
  "result": {
    "output": "file contents here...",
    "success": true,
    "stderr": undefined
  },
  "sessionId": "uuid-1234"
}
```

**Write** - Write files:

```json
{
  "type": "tool-result",
  "toolCallId": "call_ghi789",
  "toolName": "Write",
  "result": {
    "output": "Successfully wrote to /path/to/file.txt",
    "success": true
  },
  "sessionId": "uuid-1234"
}
```

**Edit** - Edit files with literal text replacement:

```json
{
  "type": "tool-result",
  "toolCallId": "call_jkl012",
  "toolName": "Edit",
  "result": {
    "ok": true
  },
  "sessionId": "uuid-1234"
}
```

**MultiEdit** - Batch file edits with literal text replacement:

```json
{
  "type": "tool-result",
  "toolCallId": "call_mno345",
  "toolName": "MultiEdit",
  "result": {
    "ok": true
  },
  "sessionId": "uuid-1234"
}
```

**Glob** - Find files with patterns:

```json
{
  "type": "tool-result",
  "toolCallId": "call_pqr678",
  "toolName": "Glob",
  "result": {
    "output": "./src/file1.ts\n./src/file2.ts",
    "success": true,
    "stderr": undefined
  },
  "sessionId": "uuid-1234"
}
```

**Grep** - Search file contents:

```json
{
  "type": "tool-result",
  "toolCallId": "call_stu901",
  "toolName": "Grep",
  "result": {
    "output": "src/file.ts:10:function searchTerm() {",
    "success": true,
    "stderr": undefined
  },
  "sessionId": "uuid-1234"
}
```

**Ls** - List directories:

```json
{
  "type": "tool-result",
  "toolCallId": "call_vwx234",
  "toolName": "Ls",
  "result": {
    "output": "file1.txt\nfile2.txt\nsubdir/",
    "success": true,
    "stderr": undefined
  },
  "sessionId": "uuid-1234"
}
```

**WebFetch** - Fetch web content:

```json
{
  "type": "tool-result",
  "toolCallId": "call_yzab567",
  "toolName": "WebFetch",
  "result": {
    "url": "https://example.com/page",
    "status": 200,
    "mime": "text/html",
    "title": "Page Title",
    "text": "Main content extracted...",
    "bytes": 4096,
    "wasTruncated": false
  },
  "sessionId": "uuid-1234"
}
```

**WebSearch** - Search the web:

```json
{
  "type": "tool-result",
  "toolCallId": "call_cdef890",
  "toolName": "WebSearch",
  "result": [
    {
      "title": "Search Result Title",
      "url": "https://example.com/result",
      "snippet": "Search result description...",
      "engine": "duckduckgo"
    }
  ],
  "sessionId": "uuid-1234"
}
```

**WriteTodos** - Manage todos (evaluation phase only):

```json
{
  "type": "tool-result",
  "toolCallId": "call_ghij123",
  "toolName": "WriteTodos",
  "result": {
    "success": true,
    "todos": [
      {
        "description": "Fix TypeScript errors",
        "context": "Build process failing due to type issues"
      }
    ]
  },
  "sessionId": "uuid-1234"
}
```

#### ToolErrorMessage

Tool execution errors. Emitted when a tool fails during execution:

```json
{
  "type": "tool-error",
  "toolCallId": "call_abc123",
  "toolName": "Bash",
  "error": "Command failed: npm run typecheck - exit code 1",
  "sessionId": "uuid-1234"
}
```

The error handling system automatically catches exceptions thrown by tools and converts them into `ToolErrorMessage` events. Tools no longer need to implement their own error handling - all errors are caught and reported through this unified message type.

#### CompletedMessage

Root session completion (no parent session):

```json
{
  "type": "completed",
  "inputTokens": 1240,
  "outputTokens": 890,
  "stepCount": 12,
  "durationMs": 45000,
  "todos": [
    {
      "description": "Fix TypeScript errors",
      "context": "Build process was failing due to type issues",
      "status": "completed",
      "summary": "Successfully fixed 3 type errors in user.ts and auth.ts"
    }
  ],
  "sessionId": "uuid-1234"
}
```

#### ErrorMessage

Error handling:

```json
{
  "type": "error",
  "error": "Failed to execute command: permission denied",
  "sessionId": "uuid-1234"
}
```

## Session Continuation

### Saving Session State

```javascript
let savedTodos = null;

for await (const part of query(options)) {
  if (part.type === "completed") {
    savedTodos = part.todos;
    console.log("Session completed with todos:", part.todos);
    // Example output:
    // [
    //   {
    //     description: "Fix TypeScript errors",
    //     context: "Compilation was failing due to type issues",
    //     status: "completed",
    //     summary: "Fixed 3 type errors in user.ts and auth.ts"
    //   },
    //   {
    //     description: "Update unit tests",
    //     context: "Test coverage needed improvement after refactoring",
    //     status: "completed",
    //     summary: "Added 5 new test cases and fixed 2 failing tests"
    //   }
    // ]
  }
}
```

### Resuming Sessions

```javascript
// Resume with previous todos
const resumeOptions = {
  prompt: "Continue the implementation",
  workingDirectory: "./project",
  todos: savedTodos.map((todo) => ({
    description: todo.description,
    context: todo.context, // Preserve context information
    status: todo.status,
    summary: todo.summary, // Preserve completed work summaries
  })),
};

for await (const part of query(resumeOptions)) {
  // Process continuation...
}
```

### Todo Status Management

- `pending`: Todo not yet started
- `in_progress`: Currently being worked on
- `completed`: Successfully finished with `summary`

## Environment Setup

### Required Environment Variables

Set up at least one AI provider's API key:

```bash
# Primary provider (default)
ANTHROPIC_API_KEY=your_anthropic_key_here

# Optional additional providers
OPENAI_API_KEY=your_openai_key_here
GOOGLE_GENERATIVE_AI_API_KEY=your_google_key_here
MISTRAL_API_KEY=your_mistral_key_here
XAI_API_KEY=your_xai_key_here
TOGETHER_AI_API_KEY=your_together_key_here
```

### Development Setup

```bash
# Install dependencies
npm install

# Build project
npm run build

# Run development CLI
npm run dev -- --prompt "your prompt"

# Run built CLI
./dist/cli.js --prompt "your prompt"
```

### Model Configuration

Defaults to `anthropic/claude-3-5-sonnet-20241022` but supports multiple AI providers. Model selection is handled in `src/modelProvider.ts:8-65` with automatic provider routing based on the model string format `provider/model-name`.

## Available Tools

- **Bash**: Execute shell commands with timeout protection
- **Read**: Read file contents with line range support
- **Edit**: Make literal text replacements in files
- **MultiEdit**: Perform multiple literal text replacements in a single operation
- **Glob**: Find files using glob patterns
- **Grep**: Search file contents with regex
- **Ls**: List directory contents
- **Write**: Create or overwrite files
- **WebFetch**: Fetch and analyze web content
- **WebSearch**: Search the web for information
- **WriteTodos**: Manage todo lists (evaluation phase only)
