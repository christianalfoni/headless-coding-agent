import type { TextStreamPart, ToolSet } from "ai";

// Base session info that we add to all messages
export interface SessionInfo {
  sessionId: string;
  parentSessionId?: string;
}

// Custom stream parts for buffered content
export type CustomStreamPart = 
  | { type: 'text'; text: string; finishReason?: string }
  | { type: 'reasoning'; reasoning: string; finishReason?: string }
  | { type: 'todos'; todos: Todo[]; finishReason?: string };

// Pass-through stream parts (everything except text/reasoning start, deltas and ends, and control events)
export type PassThroughStreamPart<TOOLS extends ToolSet = ToolSet> = Exclude<
  TextStreamPart<TOOLS>,
  | { type: 'start' }
  | { type: 'start-step' }
  | { type: 'finish-step' }
  | { type: 'text-start' }
  | { type: 'text-delta' }
  | { type: 'text-end' }
  | { type: 'reasoning-start' }
  | { type: 'reasoning-delta' }
  | { type: 'reasoning-end' }
>;

// Combined stream parts - either pass-through or custom
export type FilteredStreamPart<TOOLS extends ToolSet = ToolSet> = 
  | PassThroughStreamPart<TOOLS>
  | CustomStreamPart;

// Extended stream parts with session information
export type SessionStreamPart<TOOLS extends ToolSet = ToolSet> =
  FilteredStreamPart<TOOLS> & SessionInfo;

// Session interface
export interface Session {
  sessionId: string;
  parentSession?: { sessionId: string };
  env: {
    model: any; // AI model instance
  };
  todos: Todo[];
  stepCount: number;
  step(): void;
}

// Todo interface (kept from original)
export interface Todo {
  description: string;
  status: "pending" | "in_progress" | "completed";
  textOutput?: string;
}
