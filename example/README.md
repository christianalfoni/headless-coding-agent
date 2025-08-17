# Headless Agent Example Chat Interface

This is an interactive chat interface for the headless-code library that provides a nice user experience for interacting with AI agents.

## Features

- **Interactive Chat Interface**: Write prompts and get formatted responses
- **Prevent Input During Execution**: You cannot write new prompts while the agent is running
- **Todo Continuation**: Automatically passes incomplete todos from previous conversations to new ones
- **Nice Formatting**: 
  - Different icons and colors for different message types
  - Tool usage indicators
  - Todo list tracking
  - Formatted error messages
  - Truncated long outputs for readability

## Usage

```bash
# Start the interactive chat
npm start

# Or use the dev script
npm run dev
```

Once running:
- Type your prompts to interact with the agent
- Wait for the agent to complete before entering new prompts
- Type "exit" or "quit" to leave the chat
- Use Ctrl+C to exit at any time

## Message Types

The interface formats different types of agent messages:

- 💬 **Text Messages**: Regular agent responses
- 🔧 **Tool Usage**: When the agent uses tools (shows tool name and parameters)
- ✅/❌ **Tool Results**: Success or error results from tool execution
- 📋 **Todos**: Todo list updates with status indicators
- ✨ **Session Complete**: When the agent finishes its task

## Todo Continuation

The chat interface automatically tracks todos from the agent and passes incomplete ones to subsequent conversations, ensuring continuity across multiple interactions.