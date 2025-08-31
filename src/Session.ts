import { v4 as uuidv4 } from "uuid";
import {
  Todo,
  PromptMessage,
  TodosMessage,
  Message,
  TextMessage,
  ReasoningMessage,
  CompletedMessage,
} from "./types.js";
import { SessionEnvironment } from "./Environment.js";
import { streamPrompt as streamPromptAnthropic } from "./prompt-anthropic.js";
import { streamPrompt as streamPromptOpenAI } from "./prompt-openai.js";
import { streamPrompt as streamPromptTogether } from "./prompt-together.js";
import { ModelPromptFunction } from "./index.js";
import { write_todos } from "./tools/write_todos.js";
import { bash } from "./tools/bash.js";
import { str_replace_based_edit_tool } from "./tools/str_replace_based_edit_tool.js";
import { web_search } from "./tools/web_search.js";
import { web_fetch } from "./tools/web_fetch.js";

export class Session {
  static async *create(
    userPrompt: string,
    env: SessionEnvironment,
    models: ModelPromptFunction,
    initialTodos?: Todo[]
  ) {
    const session = new Session(userPrompt, env, models, initialTodos);

    return yield* session.exec();
  }
  public readonly sessionId: string;
  public todos: Todo[];
  public env: SessionEnvironment;
  public inputTokens: number;
  public outputTokens: number;
  public totalCostCents: number;
  public stepCount: number;
  public userPrompt: string;
  public readonly startTime: Date;
  public models: ModelPromptFunction;
  public reasoningEffort: "high" | "medium" | "low";

  constructor(
    userPrompt: string,
    env: SessionEnvironment,
    models: ModelPromptFunction,
    initialTodos?: Todo[]
  ) {
    this.sessionId = uuidv4();
    this.userPrompt = userPrompt;
    this.todos = initialTodos ? initialTodos : [];
    this.env = env;
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.totalCostCents = 0;
    this.stepCount = 0;
    this.startTime = new Date();
    this.models = models;
    this.reasoningEffort = "medium"; // default value
  }

  step(inputTokens: number, outputTokens: number, costCents: number): void {
    this.stepCount++;

    // Update token counts
    this.inputTokens += inputTokens;
    this.outputTokens += outputTokens;
    this.totalCostCents += costCents;

    if (this.env.maxSteps && this.stepCount > this.env.maxSteps) {
      throw new Error(
        `Maximum steps exceeded: ${this.stepCount}/${this.env.maxSteps}`
      );
    }
  }

  getMaxSteps(): number | undefined {
    return this.env.maxSteps;
  }

  private generateTodoContext(todos: Todo[]): string {
    if (todos.length === 0) {
      return "No todos available";
    }

    return todos
      .map((todo, index) => {
        let statusIcon = "";
        switch (todo.status) {
          case "completed":
            statusIcon = "✅";
            break;
          case "in_progress":
            statusIcon = "🔄";
            break;
          case "pending":
            statusIcon = "⏳";
            break;
        }

        let line = `${index + 1}. ${statusIcon} ${todo.description}`;
        if (todo.summary) {
          line += ` (${todo.summary})`;
        }

        return line;
      })
      .join("\n");
  }

  private getStreamPromptForProvider(
    provider: "anthropic" | "openai" | "together"
  ) {
    switch (provider) {
      case "anthropic":
        return streamPromptAnthropic;
      case "openai":
        return streamPromptOpenAI;
      case "together":
        return streamPromptTogether;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async *exec(): AsyncGenerator<Message> {
    yield* this.evaluateTodos();

    while (this.todos.some((todo) => todo.status === "pending")) {
      // Find the first pending todo
      const pendingTodo = this.todos.find((todo) => todo.status === "pending");
      if (!pendingTodo) break;

      // Mark todo as in_progress
      pendingTodo.status = "in_progress";

      yield {
        type: "todos" as const,
        todos: structuredClone(this.todos),
        reasoningEffort: this.reasoningEffort,
      };

      // Execute the todo as a prompt in the child session
      const text = yield* this.executeTodo(pendingTodo);

      // Mark todo as completed
      pendingTodo.status = "completed";
      pendingTodo.summary = text;
      yield {
        type: "todos" as const,
        todos: structuredClone(this.todos),
        reasoningEffort: this.reasoningEffort,
      };
    }

    // Only summarize if we have multiple todos
    // For single todos, the final output has already been yielded during execution
    if (this.todos.length > 1) {
      yield* this.summarizeTodos();
    }

    const durationMs = Date.now() - this.startTime.getTime();
    const completedPart: CompletedMessage = {
      type: "completed",
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      stepCount: this.stepCount,
      durationMs,
      todos: this.todos,
      sessionId: this.sessionId,
      totalCostDollars:
        this.totalCostCents > 0 ? this.totalCostCents / 100 : undefined,
    };
    yield completedPart;
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
        : "Completed todos with summaries:\nNo completed todos";

    const pendingTodosContext =
      pendingTodos.length > 0
        ? `Current pending todos:\n${JSON.stringify(pendingTodos)}`
        : "Current pending todos:\nNo pending todos";

    const context = [completedTodosContext, pendingTodosContext].join("\n\n");

    // Use just the user prompt for reasoning effort evaluation
    const basePrompt = this.userPrompt;

    // Evaluate reasoning effort using the new evaluatePrompt method
    this.reasoningEffort = await this.evaluatePrompt(basePrompt);

    const modelConfig = await this.models.evaluateTodos({
      workspacePath: this.env.workingDirectory,
      todos: this.todos,
      prompt: basePrompt,
      todosContext: context, // Pass context separately
      hasCompletedTodos: completedTodos.length > 0,
      hasPendingTodos: pendingTodos.length > 0,
    });

    const systemPrompt = modelConfig.systemPrompt;
    const prompt = modelConfig.prompt;
    const streamPromptFn = this.getStreamPromptForProvider(
      modelConfig.provider
    );

    const stream = streamPromptFn({
      session: this,
      system: systemPrompt,
      prompt,
      tools: {
        write_todos: write_todos(),
        bash: bash(this.env.workingDirectory),
      },
      planningMode: true,
      reasoningEffort: this.reasoningEffort,
      verbosity: "low",
      returnOnToolResult: "write_todos",
    });

    let todosWritten: Array<{
      description: string;
      reasoningEffort: "high" | "medium" | "low";
    }> = [];

    for await (const part of stream) {
      if (part.type === "tool-call" && part.toolName === "write_todos") {
        todosWritten = part.args.todos;
        continue;
      }

      if (part.type === "tool-result" && part.toolName === "write_todos") {
        // Create todos with programmatically generated context
        const newTodos = todosWritten.map((todo) => ({
          ...todo,
          status: "pending" as const,
          context: "", // Will be filled programmatically below
        }));

        this.todos = [...completedTodos, ...newTodos];

        // Generate context for each todo based on current state
        this.todos.forEach((todo) => {
          if (todo.status === "pending") {
            todo.context = this.generateTodoContext(this.todos);
          }
        });

        yield {
          type: "todos",
          todos: structuredClone(this.todos),
          reasoningEffort: this.reasoningEffort,
        };
        // Stream will return after this due to returnOnToolResult: true
        break;
      } else {
        yield part;
      }
    }
  }

  async *executeTodo(todo: Todo) {
    const modelConfig = await this.models.executeTodo({
      workspacePath: this.env.workingDirectory,
      todo,
      todos: this.todos,
    });

    const systemPrompt = modelConfig.systemPrompt;
    const prompt = modelConfig.prompt;
    const streamPromptFn = this.getStreamPromptForProvider(
      modelConfig.provider
    );

    // Create bash tool instance that we can dispose of later
    const bashTool = bash(this.env.workingDirectory);

    try {
      return yield* streamPromptFn({
        session: this,
        system: systemPrompt,
        prompt,
        tools: {
          bash: bashTool,
          str_replace_based_edit_tool: str_replace_based_edit_tool(
            this.env.workingDirectory
          ),
          web_search: web_search(),
          web_fetch: web_fetch(),
        },
        maxSteps: this.getMaxSteps(),
        reasoningEffort: todo.reasoningEffort,
        verbosity: "low",
      }) as AsyncGenerator<PromptMessage, string>;
    } finally {
      // Always dispose of the bash tool when done
      bashTool.dispose();
    }
  }

  async *summarizeTodos() {
    const modelConfig = await this.models.summarizeTodos({
      workspacePath: this.env.workingDirectory,
      todos: this.todos,
    });

    const systemPrompt = modelConfig.systemPrompt;
    const prompt = modelConfig.prompt;
    const streamPromptFn = this.getStreamPromptForProvider(
      modelConfig.provider
    );

    return yield* streamPromptFn({
      session: this,
      system: systemPrompt,
      prompt,
      tools: {
        write_todos: write_todos(),
      },
      maxSteps: this.getMaxSteps(),
      verbosity: "medium",
    }) as AsyncGenerator<TextMessage | ReasoningMessage, string>;
  }

  async evaluatePrompt(prompt: string): Promise<"low" | "medium" | "high"> {
    const systemPrompt = `You are evaluating the reasoning effort required to define todos for a given prompt. 

Analyze the prompt and determine the complexity level based on:
- Low: Simple, single-step tasks (e.g., "fix this typo", "add a comment")
- Medium: Multi-step tasks requiring some planning (e.g., "add a new feature", "refactor a component") 
- High: Complex tasks requiring extensive planning and coordination (e.g., "redesign the architecture", "implement a complex system")

Respond with only one word: "low", "medium", or "high". Do not include any additional text or explanation.`;

    const modelConfig = await this.models.evaluateTodos({
      workspacePath: this.env.workingDirectory,
      todos: [],
      prompt,
    });

    const streamPromptFn = this.getStreamPromptForProvider(
      modelConfig.provider
    );

    let result = "";
    const stream = streamPromptFn({
      session: this,
      system: systemPrompt,
      prompt,
      tools: {},
      verbosity: "low",
    });

    for await (const part of stream) {
      if (part.type === "text") {
        result += part.text;
      }
    }

    const trimmedResult = result.trim().toLowerCase();

    if (trimmedResult.includes("low")) {
      return "low";
    }

    if (trimmedResult.includes("high")) {
      return "high";
    }

    return "medium";
  }
}
