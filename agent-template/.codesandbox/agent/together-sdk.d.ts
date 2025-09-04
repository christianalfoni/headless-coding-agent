export interface TogetherMessage {
    role: "system" | "user" | "assistant";
    content: string;
}
export interface TogetherTool {
    id: string;
    name: string;
    description: string;
    parameters: any;
}
export interface TogetherRequest {
    temperature?: number;
    model: string;
    messages: TogetherMessage[];
    stream?: boolean;
    tools?: TogetherTool[];
    reasoning_effort?: "low" | "medium" | "high";
}
export interface TogetherToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}
export interface TogetherUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    reasoning_tokens: number;
}
export interface TogetherResponse {
    reasoning?: string;
    text?: string;
    toolCalls?: TogetherToolCall[];
    usage?: TogetherUsage;
    id?: string;
    model?: string;
}
export declare class TogetherSDK {
    private client;
    constructor(apiKey: string);
    /**
     * Fallback parsing for non-harmony responses
     * Uses the original JSON parsing logic as backup
     */
    private parseFallbackResponse;
    /**
     * Legacy tool call parsing logic (fallback)
     */
    private tryParseToolCall;
    createChatCompletion(request: TogetherRequest): Promise<TogetherResponse>;
}
//# sourceMappingURL=together-sdk.d.ts.map