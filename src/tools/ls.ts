import { tool } from 'ai';
import { z } from 'zod';
import { exec } from "child_process";
import { promisify } from "util";
import * as os from "os";

const execAsync = promisify(exec);

const inputSchema = z.object({
  lsArguments: z.string().describe("Arguments and flags for the ls command")
});

export const lsTool = tool({
  description: `List directory contents using ls command. Running on ${os.platform()}.`,
  inputSchema: inputSchema as any,
  execute: async (params: any) => {
    const args = params.lsArguments;
    const command = args ? `ls ${args}` : `ls`;

    try {
      const { stdout, stderr } = await execAsync(command);
      
      return {
        output: stdout?.toString() || "",
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