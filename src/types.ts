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
  finishReason?: string;
} & SessionInfo;
export type ReasoningMessage = {
  type: "reasoning";
  text: string;
  finishReason?: string;
} & SessionInfo;
export type TodosMessage = {
  type: "todos";
  todos: Todo[];
  finishReason?: string;
} & SessionInfo;
export type CompletedMessage = {
  type: "completed";
  inputTokens: number;
  outputTokens: number;
  stepCount: number;
  durationMs: number;
  todos?: Todo[];
} & SessionInfo;
export type ToolCallMessage = {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: any;
} & SessionInfo;
export type ToolResultMessage = {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  result: any;
  finishReason?: string;
} & SessionInfo;
export type ErrorMessage = { type: "error"; error: string } & SessionInfo;
export type FinishMessage = {
  type: "finish";
  inputTokens: number;
  outputTokens: number;
  finishReason: string;
} & SessionInfo;

// Union of all message types
export type Message =
  | TextMessage
  | ReasoningMessage
  | TodosMessage
  | CompletedMessage
  | ToolCallMessage
  | ToolResultMessage
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
