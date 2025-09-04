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
        gitRepoInfo?: {
            isGitRepo: boolean;
            org?: string;
            repo?: string;
            fullName?: string;
        };
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
    gitRepoInfo?: {
        isGitRepo: boolean;
        org?: string;
        repo?: string;
        fullName?: string;
    };
}
export declare function query(options: QueryOptions): AsyncGenerator<import("./types.js").Message, any, any>;
export * from "./types.js";
export { Session } from "./Session.js";
export { SessionEnvironment } from "./Environment.js";
//# sourceMappingURL=index.d.ts.map