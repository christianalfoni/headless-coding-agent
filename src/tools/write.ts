import { tool } from "ai";
import { z } from "zod";
import { writeFile } from "fs/promises";
import { dirname } from "path";
import { mkdir } from "fs/promises";

const inputSchema = z.object({
  filePath: z.string().describe("Path to the file to write"),
  content: z.string().describe("Content to write to the file")
});

export const Write = tool({
  description: "Write content to a file",
  inputSchema: inputSchema as any,
  execute: async (params: any) => {
    const { filePath, content } = params;

    // Ensure directory exists
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });
    
    // Write the file
    await writeFile(filePath, content, 'utf8');
    
    return {
      output: `Successfully wrote to ${filePath}`,
    };
  }
});