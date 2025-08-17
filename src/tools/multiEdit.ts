import { tool } from 'ai';
import { z } from 'zod';
import { exec } from "child_process";
import { promisify } from "util";
import * as os from "os";

const execAsync = promisify(exec);

const inputSchema = z.object({
  sedCommands: z.array(z.string()).describe("Array of sed command arguments to execute sequentially")
});

export const MultiEdit = tool({
  description: `Execute multiple sed commands sequentially for batch file editing. Running on ${os.platform()}.`,
  inputSchema: inputSchema as any,
  execute: async (params: any) => {
    const commands = params.sedCommands;
    const results = [];

    for (let i = 0; i < commands.length; i++) {
      const args = commands[i];
      const command = args ? `sed ${args}` : `sed`;

      const { stderr } = await execAsync(command);
      
      results.push({
        command: command,
        stderr: stderr?.toString() || undefined,
        index: i
      });

      // If any command fails, stop execution
      if (stderr) {
        break;
      }
    }

    const completedCount = results.length;
    const allSuccessful = results.every(r => !r.stderr);

    return {
      output: allSuccessful 
        ? `All ${completedCount} edit commands completed successfully`
        : `Completed ${completedCount}/${commands.length} edit commands`,
      results: results,
      completedCommands: completedCount,
      totalCommands: commands.length
    };
  }
});