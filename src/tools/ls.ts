import { tool } from 'ai';
import { z } from 'zod';
import { exec } from "child_process";
import { promisify } from "util";
import * as os from "os";

const execAsync = promisify(exec);

const inputSchema = z.object({
  lsArguments: z.string().describe("Arguments and flags for the ls command")
});

export const Ls = tool({
  description: `List directory contents using ls command. Running on ${os.platform()}.`,
  inputSchema: inputSchema as any,
  execute: async (params: any) => {
    const args = params.lsArguments;
    const command = args ? `ls ${args}` : `ls`;

    const { stdout, stderr } = await execAsync(command);
    
    return {
      output: stdout?.toString() || "",
      stderr: stderr?.toString() || undefined,
    };
  }
});