import { tool } from 'ai';
import { z } from 'zod';
import { exec } from "child_process";
import { promisify } from "util";
import * as os from "os";

const execAsync = promisify(exec);

const inputSchema = z.object({
  sedCommands: z.array(z.string()).describe("Array of sed command arguments to execute sequentially")
});

export const multiEditTool = tool({
  description: `Execute multiple sed commands sequentially for batch file editing. Running on ${os.platform()}.`,
  inputSchema: inputSchema as any,
  execute: async (params: any) => {
    const commands = params.sedCommands;
    const results = [];

    try {
      for (let i = 0; i < commands.length; i++) {
        const args = commands[i];
        const command = args ? `sed ${args}` : `sed`;

        try {
          const { stderr } = await execAsync(command);
          
          results.push({
            command: command,
            success: !stderr,
            stderr: stderr?.toString() || undefined,
            index: i
          });

          // If any command fails, stop execution
          if (stderr) {
            break;
          }
        } catch (error: any) {
          results.push({
            command: command,
            success: false,
            error: error.message,
            index: i
          });
          break;
        }
      }

      const allSuccessful = results.every(r => r.success);
      const completedCount = results.length;

      return {
        output: allSuccessful 
          ? `All ${completedCount} edit commands completed successfully`
          : `Completed ${completedCount}/${commands.length} edit commands`,
        success: allSuccessful,
        results: results,
        completedCommands: completedCount,
        totalCommands: commands.length
      };
    } catch (error: any) {
      return {
        output: error.message || "Multi-edit failed",
        success: false,
        error: error.message,
        results: results
      };
    }
  }
});