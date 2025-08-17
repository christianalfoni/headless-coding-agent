import { Session } from "./Session";
import { SessionEnvironment } from "./Environment";

export interface QueryOptions {
  prompt: string;
  workingDirectory: string;
  /**
   * Maximum number of steps the agent can take to complete the query.
   * @default 50
   */
  maxSteps?: number;
  model?: string;
  todos?: { description: string; context: string; status?: "pending" | "in_progress" | "completed" }[];
  stdout?: boolean;
}

export async function* query(options: QueryOptions) {
  const context = new SessionEnvironment(
    options.workingDirectory,
    undefined,
    options.maxSteps ?? 50,
    options.model,
    options.stdout || false
  );
  return yield* Session.create(options.prompt, context, undefined, options.todos);
}
