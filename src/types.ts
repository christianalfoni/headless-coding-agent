// Types for headless agents

// Base session info that we add to all messages
export interface SessionInfo {
  sessionId: string;
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
export type CompletedMessage = {
  type: "completed";
  inputTokens: number;
  outputTokens: number;
  stepCount: number;
  durationMs: number;
  todos?: Todo[];
} & SessionInfo;
// Tool call message types
export type WriteTodosCallMessage = {
  type: "tool-call";
  toolCallId: string;
  toolName: "write_todos";
  args: { todos: Array<{ description: string; context: string }> };
};

export type BashToolCallMessage = {
  type: "tool-call";
  toolCallId: string;
  toolName: "bash";
  args: { command?: string; restart?: boolean };
} & SessionInfo;

export type StrReplaceBasedEditToolCallMessage = {
  type: "tool-call";
  toolCallId: string;
  toolName: "str_replace_based_edit_tool";
  args: {
    command: "view" | "create" | "str_replace" | "insert";
    path: string;
    file_text?: string;
    insert_line?: number;
    new_str?: string;
    old_str?: string;
    view_range?: number[];
  };
} & SessionInfo;

export type WebFetchToolCallMessage = {
  type: "tool-call";
  toolCallId: string;
  toolName: "web_fetch";
  args: { url: string; maxBytes?: number; timeoutMs?: number };
} & SessionInfo;

export type WebSearchToolCallMessage = {
  type: "tool-call";
  toolCallId: string;
  toolName: "web_search";
  args: {
    query: string;
    topK?: number;
    language?: string;
    safesearch?: number;
  };
} & SessionInfo;

export type ToolCallMessage =
  | BashToolCallMessage
  | StrReplaceBasedEditToolCallMessage
  | WebFetchToolCallMessage
  | WebSearchToolCallMessage;

// Tool result message types
export type WriteTodosResultMessage = {
  type: "tool-result";
  toolCallId: string;
  toolName: "write_todos";
  result: { todos: Todo[] };
};
export type BashToolResultMessage = {
  type: "tool-result";
  toolCallId: string;
  toolName: "bash";
  result: { stdout: string; stderr: string; exitCode: number };
} & SessionInfo;

export type StrReplaceBasedEditToolResultMessage = {
  type: "tool-result";
  toolCallId: string;
  toolName: "str_replace_based_edit_tool";
  result: string;
} & SessionInfo;

export type WebFetchToolResultMessage = {
  type: "tool-result";
  toolCallId: string;
  toolName: "web_fetch";
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
  toolName: "web_search";
  result: Array<{
    title: string;
    url: string;
    snippet: string;
    engine: string;
  }>;
} & SessionInfo;

export type ToolResultMessage =
  | BashToolResultMessage
  | StrReplaceBasedEditToolResultMessage
  | WebFetchToolResultMessage
  | WebSearchToolResultMessage;

// Tool error message types
export type BashToolErrorMessage = {
  type: "tool-error";
  toolCallId: string;
  toolName: "bash";
  error: string;
} & SessionInfo;

export type StrReplaceBasedEditToolErrorMessage = {
  type: "tool-error";
  toolCallId: string;
  toolName: "str_replace_based_edit_tool";
  error: string;
} & SessionInfo;

export type WebFetchToolErrorMessage = {
  type: "tool-error";
  toolCallId: string;
  toolName: "web_fetch";
  error: string;
} & SessionInfo;

export type WebSearchToolErrorMessage = {
  type: "tool-error";
  toolCallId: string;
  toolName: "web_search";
  error: string;
} & SessionInfo;

export type ToolErrorMessage =
  | BashToolErrorMessage
  | StrReplaceBasedEditToolErrorMessage
  | WebFetchToolErrorMessage
  | WebSearchToolErrorMessage;
export type ErrorMessage = { type: "error"; error: string } & SessionInfo;

export type TodosMessage = {
  type: "todos";
  todos: Todo[];
};

export type Message = PromptMessage | TodosMessage | CompletedMessage;

// Union of all message types
export type PromptMessage =
  | TextMessage
  | ReasoningMessage
  | ToolCallMessage
  | ToolResultMessage
  | ToolErrorMessage
  | ErrorMessage;

// Todo interface (kept from original)
export interface Todo {
  description: string;
  context: string;
  status: "pending" | "in_progress" | "completed";
  summary?: string;
}
