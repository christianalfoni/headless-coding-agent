// Types for headless agents

// Base session info that we add to all messages
export interface SessionInfo {
  sessionId: string;
  parentSessionId?: string;
}

// Individual message types that compose SessionInfo
export type TextMessage = {
  type: "text";
  text: string;
} & SessionInfo;
export type ReasoningMessage = {
  type: "reasoning";
  text: string;
} & SessionInfo;
export type TodosMessage = {
  type: "todos";
  todos: Todo[];
} & SessionInfo;
export type CompletedMessage = {
  type: "completed";
  inputTokens: number;
  outputTokens: number;
  stepCount: number;
  durationMs: number;
  todos?: Todo[];
} & SessionInfo;
// Tool call message types
export type BashToolCallMessage = {
  type: "tool-call";
  toolCallId: string;
  toolName: "Bash";
  args: { bashCommand: string };
} & SessionInfo;

export type ReadToolCallMessage = {
  type: "tool-call";
  toolCallId: string;
  toolName: "Read";
  args: { catArguments: string };
} & SessionInfo;

export type EditToolCallMessage = {
  type: "tool-call";
  toolCallId: string;
  toolName: "Edit";
  args: { 
    file: string; 
    find: string; 
    replace: string; 
    replaceAll: boolean; 
  };
} & SessionInfo;

export type WriteToolCallMessage = {
  type: "tool-call";
  toolCallId: string;
  toolName: "Write";
  args: { filePath: string; content: string };
} & SessionInfo;

export type LsToolCallMessage = {
  type: "tool-call";
  toolCallId: string;
  toolName: "Ls";
  args: { lsArguments: string };
} & SessionInfo;

export type GlobToolCallMessage = {
  type: "tool-call";
  toolCallId: string;
  toolName: "Glob";
  args: { globArguments: string };
} & SessionInfo;

export type GrepToolCallMessage = {
  type: "tool-call";
  toolCallId: string;
  toolName: "Grep";
  args: { grepArguments: string };
} & SessionInfo;

export type MultiEditToolCallMessage = {
  type: "tool-call";
  toolCallId: string;
  toolName: "MultiEdit";
  args: { 
    file: string; 
    edits: Array<{
      find: string;
      replace: string;
      replaceAll: boolean;
    }>;
  };
} & SessionInfo;

export type WebFetchToolCallMessage = {
  type: "tool-call";
  toolCallId: string;
  toolName: "WebFetch";
  args: { url: string; maxBytes?: number; timeoutMs?: number };
} & SessionInfo;

export type WebSearchToolCallMessage = {
  type: "tool-call";
  toolCallId: string;
  toolName: "WebSearch";
  args: { query: string; topK?: number; language?: string; safesearch?: number };
} & SessionInfo;

export type ToolCallMessage =
  | BashToolCallMessage
  | ReadToolCallMessage
  | EditToolCallMessage
  | WriteToolCallMessage
  | LsToolCallMessage
  | GlobToolCallMessage
  | GrepToolCallMessage
  | MultiEditToolCallMessage
  | WebFetchToolCallMessage
  | WebSearchToolCallMessage;
// Tool result message types
export type BashToolResultMessage = {
  type: "tool-result";
  toolCallId: string;
  toolName: "Bash";
  result: { stdout: string; stderr?: string };
} & SessionInfo;

export type ReadToolResultMessage = {
  type: "tool-result";
  toolCallId: string;
  toolName: "Read";
  result: { output: string; stderr?: string };
} & SessionInfo;

export type EditToolResultMessage = {
  type: "tool-result";
  toolCallId: string;
  toolName: "Edit";
  result: { ok: boolean };
} & SessionInfo;

export type WriteToolResultMessage = {
  type: "tool-result";
  toolCallId: string;
  toolName: "Write";
  result: { output: string };
} & SessionInfo;

export type LsToolResultMessage = {
  type: "tool-result";
  toolCallId: string;
  toolName: "Ls";
  result: { output: string; stderr?: string };
} & SessionInfo;

export type GlobToolResultMessage = {
  type: "tool-result";
  toolCallId: string;
  toolName: "Glob";
  result: { output: string; stderr?: string };
} & SessionInfo;

export type GrepToolResultMessage = {
  type: "tool-result";
  toolCallId: string;
  toolName: "Grep";
  result: { output: string; stderr?: string };
} & SessionInfo;

export type MultiEditToolResultMessage = {
  type: "tool-result";
  toolCallId: string;
  toolName: "MultiEdit";
  result: { ok: boolean };
} & SessionInfo;

export type WebFetchToolResultMessage = {
  type: "tool-result";
  toolCallId: string;
  toolName: "WebFetch";
  result: {
    url: string;
    status: number;
    mime: string;
    title: string;
    text: string;
    bytes: number;
    wasTruncated: boolean;
  };
} & SessionInfo;

export type WebSearchToolResultMessage = {
  type: "tool-result";
  toolCallId: string;
  toolName: "WebSearch";
  result: Array<{
    title: string;
    url: string;
    snippet: string;
    engine: string;
  }>;
} & SessionInfo;

export type ToolResultMessage =
  | BashToolResultMessage
  | ReadToolResultMessage
  | EditToolResultMessage
  | WriteToolResultMessage
  | LsToolResultMessage
  | GlobToolResultMessage
  | GrepToolResultMessage
  | MultiEditToolResultMessage
  | WebFetchToolResultMessage
  | WebSearchToolResultMessage;
// Tool error message types
export type BashToolErrorMessage = {
  type: "tool-error";
  toolCallId: string;
  toolName: "Bash";
  error: string;
} & SessionInfo;

export type ReadToolErrorMessage = {
  type: "tool-error";
  toolCallId: string;
  toolName: "Read";
  error: string;
} & SessionInfo;

export type EditToolErrorMessage = {
  type: "tool-error";
  toolCallId: string;
  toolName: "Edit";
  error: string;
} & SessionInfo;

export type WriteToolErrorMessage = {
  type: "tool-error";
  toolCallId: string;
  toolName: "Write";
  error: string;
} & SessionInfo;

export type LsToolErrorMessage = {
  type: "tool-error";
  toolCallId: string;
  toolName: "Ls";
  error: string;
} & SessionInfo;

export type GlobToolErrorMessage = {
  type: "tool-error";
  toolCallId: string;
  toolName: "Glob";
  error: string;
} & SessionInfo;

export type GrepToolErrorMessage = {
  type: "tool-error";
  toolCallId: string;
  toolName: "Grep";
  error: string;
} & SessionInfo;

export type MultiEditToolErrorMessage = {
  type: "tool-error";
  toolCallId: string;
  toolName: "MultiEdit";
  error: string;
} & SessionInfo;

export type WebFetchToolErrorMessage = {
  type: "tool-error";
  toolCallId: string;
  toolName: "WebFetch";
  error: string;
} & SessionInfo;

export type WebSearchToolErrorMessage = {
  type: "tool-error";
  toolCallId: string;
  toolName: "WebSearch";
  error: string;
} & SessionInfo;

export type ToolErrorMessage =
  | BashToolErrorMessage
  | ReadToolErrorMessage
  | EditToolErrorMessage
  | WriteToolErrorMessage
  | LsToolErrorMessage
  | GlobToolErrorMessage
  | GrepToolErrorMessage
  | MultiEditToolErrorMessage
  | WebFetchToolErrorMessage
  | WebSearchToolErrorMessage;
export type ErrorMessage = { type: "error"; error: string } & SessionInfo;
export type FinishMessage = {
  type: "finish";
  inputTokens: number;
  outputTokens: number;
} & SessionInfo;

// Union of all message types
export type Message =
  | TextMessage
  | ReasoningMessage
  | TodosMessage
  | CompletedMessage
  | ToolCallMessage
  | ToolResultMessage
  | ToolErrorMessage
  | ErrorMessage
  | FinishMessage;

// Session interface
export interface Session {
  sessionId: string;
  parentSession?: { sessionId: string };
  env: {
    model: any; // AI model instance
  };
  todos: Todo[];
  stepCount: number;
  inputTokens: number;
  outputTokens: number;
  startTime: Date;
  step(): void;
  increaseTokens(inputTokens: number, outputTokens: number): void;
}

// Todo interface (kept from original)
export interface Todo {
  description: string;
  context: string;
  status: "pending" | "in_progress" | "completed";
  summary?: string;
}
