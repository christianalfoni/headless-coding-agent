import { Tool } from "ai";
import { Session, Message } from "./types";
export declare function streamPrompt(config: {
    session: Session;
    system: string;
    prompt: string;
    tools: Record<string, Tool>;
    toolChoice: "auto" | "required";
    maxSteps?: number;
    usePlanningModel?: boolean;
}): AsyncGenerator<Message>;
//# sourceMappingURL=prompt.d.ts.map