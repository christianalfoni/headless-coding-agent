import { Session } from "./Session";
import { SessionEnvironment } from "./Environment";
import { Todo } from "./types";

export interface QueryOptions {
  prompt: string;
  workingDirectory: string;
  /**
   * Maximum number of steps the agent can take to complete the query.
   * @default 50
   */
  maxSteps?: number;
  model?: string;
  /**
   * Model to use for planning/evaluating todos. Expected to be a "smarter" model
   * for optimizing context and determining next steps efficiently.
   */
  planningModel?: string;
  todos?: Todo[];
}

export async function* query(options: QueryOptions) {
  const context = new SessionEnvironment(
    options.workingDirectory,
    undefined,
    options.maxSteps ?? 50,
    options.model,
    options.planningModel
  );
  return yield* Session.create(
    options.prompt,
    context,
    options.todos
  );
}

// Re-export all types for SDK usage
export * from "./types";
export { Session } from "./Session";
export { SessionEnvironment } from "./Environment";
