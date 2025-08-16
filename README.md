# 🤖 Unleash the Power of AI Coding - Your Unstoppable Dev Partner

A headless coding agent that provides AI-powered development capabilities through streaming JSON output. Built on the foundation of Claude Code, this agent can autonomously handle complex coding tasks, manage sessions, delegate work to sub-agents, and integrate with external tools through MCP servers.

## Features

### Core Capabilities

- **Autonomous Coding**: Plans, implements, and tests code changes
- **Terminal Tool Access**: Execute bash commands, search files, edit code
- **Web Search Integration**: Research documentation and solutions
- **Session Management**: Persistent conversation state and context
- **Sub-Agent Delegation**: Creates specialized agents for focused tasks
- **Task Management**: Continuously analyzes and tracks work to be done
- **MCP Server Integration**: Connect to external APIs and data sources

### Available Tools

- **Bash**: Execute shell commands and scripts
- **Edit/MultiEdit**: Make targeted or bulk file modifications
- **Glob**: Find files using pattern matching
- **Grep**: Search file contents with regex support
- **LS**: List files and directories
- **Read**: Read file contents with line range support
- **WebSearch**: Search the web for information
- **WebFetch**: Fetch and analyze web content
- **TodoWrite**: Manage and track tasks

## Usage Modes

### 1. Terminal Streaming Mode

Run the agent directly in terminal with streaming JSON output:

```bash
npx headless-coding-agent \
  --prompt "Fix all TypeScript errors in this project" \
  --api-key "your-claude-api-key"
```

### 2. Node.js SDK Mode

Use the agent programmatically in your Node.js applications:

```javascript
import { HeadlessCodingAgent } from "headless-coding-agent";

const agent = new HeadlessCodingAgent({
  apiKey: "your-claude-api-key",
  onMessage: (message) => {
    console.log("Agent message:", message);
  },
  onError: (error) => {
    console.error("Agent error:", error);
  },
  onComplete: (result) => {
    console.log("Task completed:", result);
  },
});

// Start a coding session
const session = await agent.createSession({
  prompt: "Implement a REST API for user management",
  workingDirectory: "./my-project",
  memory: {
    projectContext: "Node.js Express.js TypeScript project",
    codingStandards: "Follow clean code principles",
  },
});

// Stream results
for await (const update of session.stream()) {
  console.log(update);
}
```

## Configuration

### Basic Configuration

```json
{
  "apiKey": "your-claude-api-key",
  "model": "claude-3-sonnet-20241022",
  "maxTokens": 4096,
  "temperature": 0.1,
  "workingDirectory": "./",
  "tools": ["bash", "edit", "read", "grep", "glob", "web-search"],
  "enableSubAgents": true,
  "taskManagement": {
    "autoTrack": true,
    "breakdownComplexTasks": true
  }
}
```

### Memory Configuration

The agent uses hierarchical memory management through CLAUDE.md files:

```markdown
# Project Memory

## Coding Standards

- Use TypeScript for all new code
- Follow ESLint configuration
- Write unit tests for all functions

## Architecture

- Clean architecture with domain/infrastructure layers
- Use dependency injection
- Implement error handling with custom Error classes

## Current Tasks

- Refactor user service to use new auth system
- Implement rate limiting middleware
- Add comprehensive logging
```

### MCP Server Integration

Connect to external tools and data sources:

```json
{
  "mcpServers": {
    "github": {
      "type": "stdio",
      "command": "mcp-server-github",
      "args": ["--token", "${GITHUB_TOKEN}"]
    },
    "database": {
      "type": "http",
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${DB_TOKEN}"
      }
    },
    "slack": {
      "type": "sse",
      "url": "https://slack-mcp.example.com/stream",
      "auth": {
        "type": "oauth2",
        "clientId": "${SLACK_CLIENT_ID}"
      }
    }
  }
}
```

## Session Management

### Creating Sessions

```javascript
const session = await agent.createSession({
  prompt: "Debug the authentication flow",
  sessionId: "auth-debug-001", // Optional: for resuming
  parentSessionId: "main-session", // Optional: for sub-sessions
  context: {
    files: ["./src/auth/", "./tests/auth/"],
    recentChanges: ["user.service.ts", "auth.middleware.ts"],
  },
});
```

### Sub-Sessions and Agent Delegation

```javascript
// The agent automatically creates sub-sessions for focused work
const mainSession = await agent.createSession({
  prompt: "Implement complete user management system",
});

// Agent may internally create sub-sessions like:
// - "database-schema-design"
// - "api-endpoint-implementation"
// - "unit-test-creation"
// - "integration-test-setup"
```

## Task Management

The agent continuously analyzes work and maintains a task list:

### Automatic Task Breakdown

```json
{
  "type": "task_update",
  "tasks": [
    {
      "id": "task-1",
      "description": "Analyze existing user model",
      "status": "completed",
      "subTasks": []
    },
    {
      "id": "task-2",
      "description": "Design new authentication schema",
      "status": "in_progress",
      "subTasks": [
        "Research OAuth 2.0 best practices",
        "Design JWT token structure",
        "Plan password reset flow"
      ]
    },
    {
      "id": "task-3",
      "description": "Implement password hashing",
      "status": "pending",
      "dependencies": ["task-2"]
    }
  ]
}
```

## Output Format

All agent communication uses streaming JSON:

### Message Types

#### Agent Messages

```json
{
  "type": "message",
  "sessionId": "session-123",
  "timestamp": "2024-01-15T10:30:00Z",
  "content": "I'm analyzing the TypeScript errors in your project...",
  "thinking": "The user wants me to fix TS errors. I should first run a type check to see what's broken."
}
```

#### Tool Usage

```json
{
  "type": "tool_use",
  "sessionId": "session-123",
  "timestamp": "2024-01-15T10:30:05Z",
  "tool": "bash",
  "input": {
    "command": "npx tsc --noEmit",
    "description": "Check for TypeScript errors"
  }
}
```

#### Tool Results

```json
{
  "type": "tool_result",
  "sessionId": "session-123",
  "timestamp": "2024-01-15T10:30:10Z",
  "tool": "bash",
  "success": true,
  "output": "src/user.ts(15,3): error TS2322: Type 'string' is not assignable to type 'number'"
}
```

#### Sub-Agent Creation

```json
{
  "type": "sub_agent_created",
  "sessionId": "session-123",
  "subSessionId": "subsession-456",
  "timestamp": "2024-01-15T10:31:00Z",
  "purpose": "Focus on fixing type errors in user module",
  "tools": ["edit", "read", "bash"]
}
```

#### Task Updates

```json
{
  "type": "task_update",
  "sessionId": "session-123",
  "timestamp": "2024-01-15T10:31:30Z",
  "action": "created",
  "task": {
    "id": "task-7",
    "description": "Fix type error in user.ts line 15",
    "status": "pending",
    "priority": "high"
  }
}
```

#### Completion

```json
{
  "type": "completion",
  "sessionId": "session-123",
  "timestamp": "2024-01-15T10:45:00Z",
  "success": true,
  "summary": "Fixed 12 TypeScript errors across 5 files",
  "changes": [
    "user.ts: Fixed type annotation on userId property",
    "auth.ts: Added proper return type to validateToken function",
    "database.ts: Updated interface definitions"
  ],
  "testsRun": true,
  "testResults": "All tests passing"
}
```

#### Errors

```json
{
  "type": "error",
  "sessionId": "session-123",
  "timestamp": "2024-01-15T10:35:00Z",
  "error": "Failed to execute bash command",
  "details": "Command 'npm test' exited with code 1",
  "recoverable": true,
  "suggestedAction": "Fix failing tests before proceeding"
}
```

## Security Considerations

### Recommended Setup

- Run in containerized environment with limited privileges
- Use environment variables for sensitive credentials
- Enable audit logging for all tool usage
- Restrict file system access to project directories
- Review MCP server connections regularly

### Environment Variables

```bash
CLAUDE_API_KEY=your-api-key
GITHUB_TOKEN=your-github-token
ALLOWED_DIRECTORIES=/project,/tmp
MAX_BASH_TIMEOUT=300
ENABLE_AUDIT_LOG=true
AUDIT_LOG_PATH=/var/log/headless-agent.log
```

## Installation & Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev -- --prompt "Hello" --api-key "your-key"

# Run built CLI
./dist/cli.js --prompt "Hello" --api-key "your-key"

# Run tests
npm test
```

## API Reference

### HeadlessCodingAgent Class

#### Constructor Options

- `apiKey`: Claude API key
- `model`: Model to use (default: claude-3-sonnet-20241022)
- `maxTokens`: Maximum tokens per request
- `temperature`: Model temperature (0-1)
- `onMessage`: Callback for agent messages
- `onError`: Callback for errors
- `onComplete`: Callback for completion

#### Methods

- `createSession(options)`: Create a new coding session
- `resumeSession(sessionId)`: Resume an existing session
- `listSessions()`: List all active sessions
- `terminateSession(sessionId)`: End a session

### Session Class

#### Methods

- `stream()`: Get streaming updates from the session
- `send(message)`: Send a message to the agent
- `getContext()`: Get current session context
- `getTasks()`: Get current task list
- `getSubSessions()`: List sub-sessions

## License

MIT
