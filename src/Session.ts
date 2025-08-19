import { v4 as uuidv4 } from "uuid";
import {
  Todo,
  PromptMessage,
  TodosMessage,
  Message,
  TextMessage,
  ReasoningMessage,
  CompletedMessage,
} from "./types";
import { SessionEnvironment } from "./Environment";
import { streamPrompt } from "./prompt";
import { write_todos } from "./tools/write_todos";
import { bash } from "./tools/bash";
import { web_fetch } from "./tools/web_fetch";
import { web_search } from "./tools/web_search";
import { str_replace_based_edit_tool } from "./tools/str_replace_based_edit_tool";

const getSystemPrompt = (
  workingDirectory: string,
  planningToolTerminology?: string
) => `You are an AI assistant that breaks down user requests into isolated development todos. You are working in: ${workingDirectory}

Your task is to evaluate the current state and create a list of isolated, scoped todos that can be executed step by step, building on each other.

Guidelines for creating todos:
- Each todo should be a complete, self-contained unit of work
- Todos should build on each other sequentially 
- Make todos specific and actionable with clear deliverables
- Break complex requests into logical, isolated development steps
- Each todo should have a single clear purpose and outcome
- Consider what has been completed and what still needs to be done
- NEVER create testing, verification, or validation todos - each todo must handle its own testing internally
- AVOID todos like "run tests", "verify changes", "check functionality" - these are not separate tasks

Always use the writeTodos ${
  planningToolTerminology?.slice(0, -1) || "tool"
} to provide the updated list of pending todos needed to complete the user's request.`;

export class Session {
  static async *create(
    userPrompt: string,
    env: SessionEnvironment,
    initialTodos?: Todo[]
  ) {
    const session = new Session(userPrompt, env, initialTodos);

    return yield* session.exec();
  }
  public readonly sessionId: string;
  public todos: Todo[];
  public env: SessionEnvironment;
  public inputTokens: number;
  public outputTokens: number;
  public stepCount: number;
  public userPrompt: string;
  public readonly startTime: Date;

  constructor(
    userPrompt: string,
    env: SessionEnvironment,
    initialTodos?: Todo[]
  ) {
    this.sessionId = uuidv4();
    this.userPrompt = userPrompt;
    this.todos = initialTodos ? initialTodos : [];
    this.env = env;
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.stepCount = 0;
    this.startTime = new Date();
  }

  step(): void {
    this.stepCount++;
    if (this.env.maxSteps && this.stepCount > this.env.maxSteps) {
      throw new Error(
        `Maximum steps exceeded: ${this.stepCount}/${this.env.maxSteps}`
      );
    }
  }

  increaseTokens(inputTokens: number, outputTokens: number): void {
    this.inputTokens += inputTokens;
    this.outputTokens += outputTokens;
  }

  getMaxSteps(): number | undefined {
    return this.env.maxSteps;
  }

  async *exec(): AsyncGenerator<Message> {
    yield* this.evaluateTodos();
    yield* this.delegateTodos();

    const finalText = yield* this.summarizeTodos();

    const durationMs = Date.now() - this.startTime.getTime();
    const completedPart: CompletedMessage = {
      type: "completed",
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      stepCount: this.stepCount,
      durationMs,
      todos: this.todos,
      sessionId: this.sessionId,
    };
    yield completedPart;

    return finalText;
  }

  async *evaluateTodos(): AsyncGenerator<PromptMessage | TodosMessage> {
    const completedTodos = this.todos.filter(
      (todo) => todo.status === "completed"
    );
    const pendingTodos = this.todos.filter((todo) => todo.status === "pending");

    const completedTodosContext =
      completedTodos.length > 0
        ? `Completed todos with summaries:\n${JSON.stringify(
            completedTodos.map((todo) => ({
              description: todo.description,
              summary: todo.summary,
            }))
          )}`
        : "";

    const pendingTodosContext =
      pendingTodos.length > 0
        ? `Current pending todos:\n${JSON.stringify(pendingTodos)}`
        : "";

    const context = [completedTodosContext, pendingTodosContext]
      .filter(Boolean)
      .join("\n\n");

    const prompt = `${this.userPrompt}${context ? `\n\n${context}` : ""}

Please evaluate the current pending todos based on what has been completed (including their summaries) and provide an updated list of todos needed to complete the request.

IMPORTANT: Do not create testing todos. Each todo will handle its own verification internally.`;

    const stream = streamPrompt({
      session: this,
      system: getSystemPrompt(this.env.workingDirectory),
      prompt,
      tools: {
        write_todos,
      },
      toolChoice: "auto",
      usePlanningModel: true,
    });

    let todosWritten: Array<{ description: string; context: string }> = [];

    for await (const part of stream) {
      if (part.type === "tool-call" && part.toolName === "write_todos") {
        todosWritten = part.args.todos;
        continue;
      }

      if (part.type === "tool-result" && part.toolName === "write_todos") {
        this.todos = [
          ...completedTodos,
          ...todosWritten.map((todo) => ({
            ...todo,
            status: "pending" as const,
          })),
        ];
        yield {
          type: "todos",
          todos: structuredClone(this.todos),
        };
      } else {
        yield part;
      }
    }
  }

  async *executeTodo(todo: Todo) {
    const remainingPendingTodos = this.todos.filter(
      (t) => t.status === "pending"
    );

    const remainingTodosContext =
      remainingPendingTodos.length > 0
        ? `\n\nRemaining pending todos (do NOT implement these - they will be handled separately):\n${remainingPendingTodos
            .map((t) => `- ${t.description}`)
            .join("\n")}`
        : "";

    const systemPrompt = `You are an AI assistant that executes todos. You have been given a specific todo to accomplish.

Working directory: ${this.env.workingDirectory}

CRITICAL: You must ONLY do what is described in the todo. Do not go beyond the scope of the todo description. Do not add extra features, improvements, or related work unless explicitly mentioned in the todo itself.${remainingTodosContext}

IMPORTANT: When the todo is ambiguous, ask for clarification rather than making assumptions. Prefer conservative, minimal actions over comprehensive solutions. Focus strictly on the described task and nothing more.

AVAILABLE TOOLS:
- str_replace_based_edit_tool: For reading, creating, editing, and modifying files in the codebase
- bash: For running commands, tests, builds, and system operations  
- web_search: ONLY use when explicitly asked to search the web or find current information online
- web_fetch: For fetching the content found with web_search

IMPORTANT: When working with files, ALWAYS use str_replace_based_edit_tool - this is your primary tool for file operations.

Before using any tools, determine if this todo can be answered from your existing knowledge:
- For questions about concepts, explanations, best practices, or general knowledge: Answer directly without using tools
- For questions requiring current/specific information about the codebase: Use str_replace_based_edit_tool to view files
- For tasks requiring modifications: Use str_replace_based_edit_tool to create, edit, or modify files
- For tasks requiring command execution: Use bash
- For tasks explicitly asking to search the web or find current online information: Use web_search and web_fetch

If you can confidently answer the question from your knowledge without needing to access files or run commands, do so directly.

TESTING: After making significant code changes (new functionality, bug fixes, refactoring), consider running relevant tests or build commands to verify the changes work correctly. Use the bash tool for testing when appropriate, but avoid excessive testing for trivial changes like text updates, comments, or documentation.

IMPORTANT: When you complete your task, always provide a clear summary of what was accomplished, including:
- A brief description of the actions taken
- References to any files that were modified, created, or analyzed using the format "file_path:line_number" when specific lines are relevant
- Any important findings or results from your work
This helps users understand exactly what was done and easily navigate to relevant code locations.
`;

    return yield* streamPrompt({
      session: this,
      system: systemPrompt,
      prompt: todo.description,
      tools: {
        str_replace_based_edit_tool,
        bash,
        web_fetch,
        web_search,
      },
      toolChoice: "auto",
      maxSteps: this.getMaxSteps(),
    }) as AsyncGenerator<PromptMessage, string>;
  }

  async *delegateTodos(): AsyncGenerator<PromptMessage | TodosMessage> {
    while (this.todos.some((todo) => todo.status === "pending")) {
      // Find the first pending todo
      const pendingTodo = this.todos.find((todo) => todo.status === "pending");
      if (!pendingTodo) break;

      // Mark todo as in_progress
      pendingTodo.status = "in_progress";

      yield {
        type: "todos" as const,
        todos: structuredClone(this.todos),
      };

      // Execute the todo as a prompt in the child session
      const text = yield* this.executeTodo(pendingTodo);

      // Mark todo as completed
      pendingTodo.status = "completed";
      pendingTodo.summary = text;
      yield {
        type: "todos" as const,
        todos: structuredClone(this.todos),
      };

      // Only re-evaluate todos if there are still pending ones
      if (this.todos.some((todo) => todo.status === "pending")) {
        yield* this.evaluateTodos();
      }
    }
  }

  async *summarizeTodos() {
    const completedTodos = this.todos.filter(
      (todo) => todo.status === "completed"
    );

    const systemPrompt = `You are an AI assistant answering the following user request: "${this.userPrompt}"

Working directory: ${this.env.workingDirectory}

Your purpose is to provide a final answer to this request. You have been given the results of completed todos that were executed to fulfill the request. Use these todo results as context to provide a comprehensive answer. 

IMPORTANT: Describe what HAS BEEN DONE, not what WILL BE DONE. Use past tense when describing the actions and results. Focus on directly addressing what the user asked for based on the completed work, not on describing the todos themselves.`;

    const prompt = completedTodos
      ? `Completed todos for context:\n${JSON.stringify(completedTodos)}`
      : "No todos were completed.";

    return yield* streamPrompt({
      session: this,
      system: systemPrompt,
      prompt,
      tools: {},
      toolChoice: "auto",
      maxSteps: this.getMaxSteps(),
    }) as AsyncGenerator<TextMessage | ReasoningMessage, string>;
  }
}
