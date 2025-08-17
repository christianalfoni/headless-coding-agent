import { tool } from 'ai';
import { z } from 'zod';
import { exec } from "child_process";
import { promisify } from "util";
import * as os from "os";

const execAsync = promisify(exec);

const inputSchema = z.object({
  grepArguments: z.string().describe("Arguments and flags for the grep command")
});

export const Grep = tool({
  description: `Search text patterns in files using grep command. Running on ${os.platform()}.`,
  inputSchema: inputSchema as any,
  execute: async (params: any) => {
    const args = params.grepArguments;
    const command = args ? `grep ${args}` : `grep`;

    const { stdout, stderr } = await execAsync(command);
    
    return {
      output: stdout?.toString() || "",
      stderr: stderr?.toString() || undefined,
    };
  }
});