import { tool } from 'ai';
import { z } from 'zod';
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const inputSchema = z.object({
  globArguments: z.string().describe("Arguments and flags for find command (used for glob patterns)")
});

export const Glob = tool({
  description: 'Find files using glob patterns with find command',
  inputSchema: inputSchema as any,
  execute: async (params: any) => {
    const args = params.globArguments;
    // Use find command for glob-like functionality
    const command = args ? `find ${args}` : `find .`;

    const { stdout, stderr } = await execAsync(command);
    
    return {
      output: stdout?.toString() || "",
      stderr: stderr?.toString() || undefined,
    };
  }
});