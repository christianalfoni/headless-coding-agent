"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateTasks = evaluateTasks;
const tasks_1 = require("../tools/tasks");
const prompt_1 = require("../prompt");
const SYSTEM = `You are an AI coding assistant that helps users accomplish their development goals by managing tasks when necessary. You are working in a coding project to help understand, analyze, and contribute with code.

When a user makes a request, evaluate whether it requires task management:
- If the request needs to be broken down into multiple actionable steps, use the WriteTasks tool to create or update tasks
- If the request is just a question or doesn't require task planning, respond normally without using the WriteTasks tool
- If tasks already exist and need updates (status changes, new tasks, removed tasks), use the WriteTasks tool

When creating tasks:
- Break down complex requests into specific, actionable coding tasks
- Each task should be clear and focused on a single development action
- Tasks can have status: "pending", "in_progress", or "completed"
- Order tasks logically based on dependencies
- Focus on practical, executable tasks that an AI agent with coding tools can accomplish
- Consider file structures, code patterns, and development best practices
- Provide a clear reason for why you're updating the tasks`;
async function* evaluateTasks(session, userPrompt) {
    const currentTasksContext = session.tasks.length > 0
        ? `Current tasks:\n${session.tasks
            .map((task, index) => `${index + 1}. ${task.description} (${task.status})`)
            .join("\n")}`
        : "No current tasks.";
    const prompt = `Working directory: ${session.env.workingDirectory}

User request: "${userPrompt}"

${currentTasksContext}`;
    yield* (0, prompt_1.streamPrompt)({
        session,
        system: SYSTEM,
        prompt,
        tools: {
            WriteTasks: tasks_1.writeTasksTool,
        },
        toolChoice: "required",
    });
}
