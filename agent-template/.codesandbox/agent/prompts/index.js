"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTaskEvaluationPrompt = createTaskEvaluationPrompt;
/**
 * Generates prompt and system messages for the model to evaluate user requests and manage tasks
 */
function createTaskEvaluationPrompt(userPrompt, currentTasks) {
    const currentTasksContext = currentTasks.length > 0
        ? `Current tasks:\n${currentTasks.map((task, index) => `${index + 1}. ${task.description} (${task.status})`).join('\n')}`
        : 'No current tasks.';
    const system = `You are an AI assistant that helps users accomplish their goals by managing tasks when necessary.

When a user makes a request, evaluate whether it requires task management:
- If the request needs to be broken down into multiple actionable steps, use the WriteTasks tool to create or update tasks
- If the request is just a question or doesn't require task planning, respond normally without using the WriteTasks tool
- If tasks already exist and need updates (status changes, new tasks, removed tasks), use the WriteTasks tool

When creating tasks:
- Break down complex requests into specific, actionable tasks
- Each task should be clear and focused on a single action
- Tasks can have status: "pending", "in_progress", or "completed"
- Order tasks logically based on dependencies
- Focus on practical, executable tasks that an AI agent with tools can accomplish
- Provide a clear reason for why you're updating the tasks`;
    const prompt = `User request: "${userPrompt}"

${currentTasksContext}`;
    return { system, prompt };
}
