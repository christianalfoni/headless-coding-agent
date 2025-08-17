import { Session } from "./Session";
import { SessionEnvironment } from "./Environment";

export interface QueryOptions {
  prompt: string;
  workingDirectory: string;
  maxSteps?: number;
  initialTodos?: { description: string; status?: "pending" | "in_progress" | "completed" }[];
}

export async function* query(options: QueryOptions) {
  const context = new SessionEnvironment(
    options.workingDirectory,
    undefined,
    options.maxSteps
  );
  return yield* Session.create(options.prompt, context, undefined, options.initialTodos);
}
