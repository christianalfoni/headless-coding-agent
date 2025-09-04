import { Session } from "./Session.js";
import { SessionEnvironment } from "./Environment.js";
import { Todo } from "./types.js";

export interface ModelPromptFunction {
  evaluateTodos: (params: {
    workspacePath: string;
    todos: Todo[];
    prompt: string;
    todosContext?: string;
    hasCompletedTodos?: boolean;
    hasPendingTodos?: boolean;
    projectAnalysis?: string;
  }) => Promise<{
    model: string;
    systemPrompt: string;
    prompt: string;
    provider: "anthropic" | "openai" | "together";
    apiKey: string;
  }>;
  evaluateProject: (params: {
    workspacePath: string;
    prompt: string;
    gitRepoInfo?: { isGitRepo: boolean; org?: string; repo?: string; fullName?: string };
  }) => Promise<{
    model: string;
    systemPrompt: string;
    prompt: string;
    provider: "anthropic" | "openai" | "together";
    apiKey: string;
  }>;
  executeTodo: (params: {
    workspacePath: string;
    todo: Todo;
    todos: Todo[];
    projectAnalysis?: string;
  }) => Promise<{
    model: string;
    systemPrompt: string;
    prompt: string;
    provider: "anthropic" | "openai" | "together";
    apiKey: string;
  }>;
  summarizeTodos: (params: {
    workspacePath: string;
    todos: Todo[];
  }) => Promise<{
    model: string;
    systemPrompt: string;
    prompt: string;
    provider: "anthropic" | "openai" | "together";
    apiKey: string;
  }>;
}

export interface QueryOptions {
  prompt: string;
  workingDirectory: string;
  /**
   * Maximum number of steps the agent can take to complete the query.
   * @default 50
   */
  maxSteps?: number;
  todos?: Todo[];
  models: ModelPromptFunction;
  gitRepoInfo?: { isGitRepo: boolean; org?: string; repo?: string; fullName?: string };
}

export async function* query(options: QueryOptions) {
  const context = new SessionEnvironment(
    options.workingDirectory,
    undefined,
    options.maxSteps ?? 50
  );

  return yield* Session.create(
    options.prompt,
    context,
    options.models,
    options.todos,
    options.gitRepoInfo
  );
}

// Re-export all types for SDK usage
export * from "./types.js";
export { Session } from "./Session.js";
export { SessionEnvironment } from "./Environment.js";
