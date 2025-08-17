import { v4 as uuidv4 } from "uuid";
import { Todo, SessionStreamPart } from "./types";
import { SessionEnvironment } from "./Environment";
import { streamPrompt } from "./prompt";
import { writeTodosTool } from "./tools/todos";
import { readTool } from "./tools/read";
import { bashTool } from "./tools/bash";
import { editTool } from "./tools/edit";
import { globTool } from "./tools/glob";
import { grepTool } from "./tools/grep";
import { lsTool } from "./tools/ls";
import { writeTool } from "./tools/write";
import { multiEditTool } from "./tools/multiEdit";
import { webFetch } from "./tools/webFetch";
import { webSearch } from "./tools/webSearch";

const getSystemPrompt = (
  workingDirectory: string
) => `You are an AI assistant that helps users accomplish their goals by managing todos. You are working in: ${workingDirectory}

Your task is to evaluate the current state of todos and provide an updated list of pending todos needed to complete the user's request.

Context provided:
- Completed todos: These tasks have already been accomplished. Review their results to understand what has been done.
- Pending todos: These are tasks that still need to be completed or re-evaluated.

When evaluating todos:
- Consider what has already been completed and its results
- Determine if pending todos are still relevant or need modification
- Add new todos if additional steps are needed based on completed work
- Remove or modify todos that are no longer necessary
- PREFER creating broader, consolidated todos that encompass multiple related actions
- Only break down requests into multiple todos for genuinely complex tasks that require distinct phases
- Most requests should result in a single comprehensive todo
- For simple questions or requests, a single "Answer the question" todo is perfectly fine
- Focus on practical, executable todos that can be accomplished with available tools

Todo Scoping Based on Tool Call Complexity:
- Available tools: bash, edit, glob, grep, ls, read, webSearch, webFetch
- Scope todos around meaningful outcomes, not individual tool calls
- Low complexity (1-3 tool calls): Create specific, granular todos for direct operations
- Medium complexity (4-8 tool calls): Group related searches, investigations, and edits into single todos
- High complexity (9+ tool calls): Break into logical phases representing complete subtasks
- Focus on final results rather than intermediate steps - many tool calls create irrelevant context
- Each todo should represent a complete unit of work where the end result matters for future context

Always use the WriteTodos tool to provide the updated list of pending todos needed to complete the user's request.`;

export class Session {
  static async *create(
    userPrompt: string,
    env: SessionEnvironment,
    parentSession?: Session,
    initialTodos?: { description: string; context: string; status?: "pending" | "in_progress" | "completed" }[]
  ) {
    const session = new Session(userPrompt, env, parentSession, initialTodos);

    return yield* session.exec();
  }
  public readonly sessionId: string;
  public todos: Todo[];
  public env: SessionEnvironment;
  public parentSession?: Session;
  public inputTokens: number;
  public outputTokens: number;
  public stepCount: number;
  public userPrompt: string;
  public readonly startTime: Date;

  constructor(
    userPrompt: string,
    env: SessionEnvironment,
    parentSession?: Session,
    initialTodos?: { description: string; context: string; status?: "pending" | "in_progress" | "completed" }[]
  ) {
    this.sessionId = uuidv4();
    this.userPrompt = userPrompt;
    this.todos = initialTodos ? initialTodos.map(todo => ({
      description: todo.description,
      context: todo.context,
      status: (todo.status || "pending") as "pending" | "in_progress" | "completed",
      summary: undefined
    })) : [];
    this.env = env;
    this.parentSession = parentSession;
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.stepCount = 0;
    this.startTime = new Date();
  }

  step(): void {
    this.stepCount++;
    if (this.parentSession) {
      this.parentSession.step();
    } else {
      // Only check maxSteps on root session (no parent)
      if (this.env.maxSteps && this.stepCount > this.env.maxSteps) {
        throw new Error(
          `Maximum steps exceeded: ${this.stepCount}/${this.env.maxSteps}`
        );
      }
    }
  }

  increaseTokens(inputTokens: number, outputTokens: number): void {
    this.inputTokens += inputTokens;
    this.outputTokens += outputTokens;
    if (this.parentSession) {
      this.parentSession.increaseTokens(inputTokens, outputTokens);
    }
  }

  getMaxSteps(): number | undefined {
    // Get the root session's maxSteps
    let rootSession: Session = this;
    while (rootSession.parentSession) {
      rootSession = rootSession.parentSession;
    }
    return rootSession.env.maxSteps;
  }

  async *exec(): AsyncGenerator<SessionStreamPart<any>> {
    yield* this.evaluateTodos();
    if (this.todos.length > 1) {
      yield* this.delegateTodos();
    } else if (this.todos[0]) {
      const summary = yield* this.executeTodo(this.todos[0]);
      this.todos[0].status = "completed";
      this.todos[0].summary = summary;
      yield {
        type: "todos" as const,
        todos: structuredClone(this.todos),
        sessionId: this.sessionId,
        parentSessionId: this.parentSession?.sessionId
      };
    }
    return yield* this.summarizeTodos();
  }

  async *evaluateTodos(): AsyncGenerator<SessionStreamPart<any>> {
    const completedTodos = this.todos.filter(
      (todo) => todo.status === "completed"
    );
    const pendingTodos = this.todos.filter((todo) => todo.status === "pending");

    const completedTodosContext =
      completedTodos.length > 0
        ? `Completed todos:\n${completedTodos
            .map(
              (todo, index) =>
                `${index + 1}. ${todo.description}${
                  todo.summary ? `\n   Result: ${todo.summary}` : ""
                }`
            )
            .join("\n")}`
        : "";

    const pendingTodosContext =
      pendingTodos.length > 0
        ? `Current pending todos:\n${pendingTodos
            .map((todo, index) => `${index + 1}. ${todo.description}`)
            .join("\n")}`
        : "";

    const context = [completedTodosContext, pendingTodosContext]
      .filter(Boolean)
      .join("\n\n");

    const prompt = `${this.userPrompt}${context ? `\n\n${context}` : ""}

Please evaluate the current pending todos and provide an updated list of todos needed to complete the request.`;

    const stream = streamPrompt({
      session: this,
      system: getSystemPrompt(this.env.workingDirectory),
      prompt,
      tools: {
        WriteTodos: writeTodosTool as any,
      },
      toolChoice: "required",
    });

    for await (const part of stream) {
      if (part.type === "todos") {
        this.todos = [
          ...completedTodos,
          ...part.todos.map((todo: Todo) => ({
            ...todo,
            status: "pending" as const,
          })),
        ];
        yield {
          type: "todos" as const,
          todos: structuredClone(this.todos),
          sessionId: this.sessionId,
          parentSessionId: this.parentSession?.sessionId
        };
      } else {
        yield part;
      }
    }
  }

  async *executeTodo(
    todo: Todo
  ): AsyncGenerator<SessionStreamPart<any>, string> {
    const systemPrompt = `You are an AI assistant that executes todos. You have been given a specific todo to accomplish. Execute the todo using the available tools.

Working directory: ${this.env.workingDirectory}

Focus on completing the todo efficiently and accurately. Use the tools available to you to accomplish the goal described in the todo.

IMPORTANT: When using the bash tool, avoid running long-running or persistent processes such as:
- Development servers (npm run dev, yarn start, etc.)
- Build watchers (npm run watch) 
- Deploy scripts
- Any process that doesn't terminate quickly

These processes will cause the execution to hang indefinitely. Instead, focus on tasks like:
- Running tests, linters, and type checkers
- One-time builds
- File operations and Git commands
- Analysis and inspection tasks

The user should handle running and reviewing long-running processes themselves.`;

    return yield* streamPrompt({
      session: this,
      system: systemPrompt,
      prompt: todo.description,
      tools: {
        readTool,
        bashTool,
        editTool,
        globTool,
        grepTool,
        lsTool,
        writeTool,
        multiEditTool,
        webFetch,
        webSearch,
      },
      toolChoice: "auto",
      maxSteps: this.getMaxSteps(),
    });
  }

  async *delegateTodos(): AsyncGenerator<SessionStreamPart<any>> {
    while (this.todos.some((todo) => todo.status === "pending")) {
      // Find the first pending todo
      const pendingTodo = this.todos.find((todo) => todo.status === "pending");
      if (!pendingTodo) break;

      // Mark todo as in_progress
      pendingTodo.status = "in_progress";
      yield {
        type: "todos" as const,
        todos: structuredClone(this.todos),
        sessionId: this.sessionId,
        parentSessionId: this.parentSession?.sessionId
      };

      // Execute the todo as a prompt in the child session
      const text = yield* Session.create(
        pendingTodo.description,
        this.env,
        this
      );

      // Mark todo as completed
      pendingTodo.status = "completed";
      pendingTodo.summary = text;
      yield {
        type: "todos" as const,
        todos: structuredClone(this.todos),
        sessionId: this.sessionId,
        parentSessionId: this.parentSession?.sessionId
      };

      yield* this.evaluateTodos();
    }
  }

  async *summarizeTodos(): AsyncGenerator<SessionStreamPart<any>, string> {
    const completedTodos = this.todos
      .filter((todo) => todo.status === "completed")
      .map(
        (todo, index) =>
          `${index + 1}. ${todo.description}${
            todo.summary ? `\n   Result: ${todo.summary}` : ""
          }`
      )
      .join("\n");

    const systemPrompt = `You are an AI assistant answering the following user request: "${this.userPrompt}"

Working directory: ${this.env.workingDirectory}

Your purpose is to provide a final answer to this request. You have been given the results of completed todos that were executed to fulfill the request. Use these todo results as context to provide a comprehensive answer. 

IMPORTANT: Describe what HAS BEEN DONE, not what WILL BE DONE. Use past tense when describing the actions and results. Focus on directly addressing what the user asked for based on the completed work, not on describing the todos themselves.`;

    const prompt = completedTodos
      ? `Completed todos for context:\n${completedTodos}`
      : "No todos were completed.";

    return yield* streamPrompt({
      session: this,
      system: systemPrompt,
      prompt,
      tools: {},
      toolChoice: "auto",
      maxSteps: this.getMaxSteps(),
    });
  }
}
