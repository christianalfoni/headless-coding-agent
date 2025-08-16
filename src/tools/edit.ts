import { tool } from 'ai';
import { z } from 'zod';
import { exec } from "child_process";
import { promisify } from "util";
import * as os from "os";

const execAsync = promisify(exec);

const inputSchema = z.object({
  sedArguments: z.string().describe("Arguments and flags for the sed command")
});

export const editTool = tool({
  description: `Edit files using sed command. Running on ${os.platform()}.`,
  inputSchema: inputSchema as any,
  execute: async (params: any) => {
    const args = params.sedArguments;
    const command = args ? `sed ${args}` : `sed`;

    try {
      const { stderr } = await execAsync(command);
      
      return {
        output: stderr ? stderr.toString() : "Edit completed successfully",
        success: !stderr,
        stderr: stderr?.toString() || undefined,
      };
    } catch (error: any) {
      return {
        output: error.message || "Command failed",
        success: false,
        error: error.message,
      };
    }
  }
});