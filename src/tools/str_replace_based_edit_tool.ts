import * as fs from "fs/promises";
import * as path from "path";

// Function version that includes working directory context
export function str_replace_based_edit_tool(workingDirectory: string) {
  return {
    id: "anthropic.textEditor_20250429",
    name: "str_replace_based_edit_tool",
    description: `File operations like string replacement, creation, viewing, and insertion. Working directory: ${workingDirectory}. Use relative paths from this directory or absolute paths.`,
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          enum: ["view", "create", "str_replace", "insert"],
          description: "The file operation to perform",
        },
        path: {
          type: "string",
          description: "The file path to operate on",
        },
        file_text: {
          type: "string",
          description: "The content for create command",
        },
        insert_line: {
          type: "number",
          description: "Line number to insert at (for insert command)",
        },
        new_str: {
          type: "string",
          description: "New string to replace with (for str_replace command)",
        },
        old_str: {
          type: "string",
          description: "Old string to replace (for str_replace command)",
        },
        view_range: {
          type: "array",
          items: { type: "number" },
          minItems: 2,
          maxItems: 2,
          description:
            "Start and end line numbers for view command [start, end]",
        },
      },
      required: ["command", "path"],
    },
    execute: async ({
      command,
      path: filePath,
      file_text,
      insert_line,
      new_str,
      old_str,
      view_range,
    }: {
      command: "view" | "create" | "str_replace" | "insert";
      path: string;
      file_text?: string;
      insert_line?: number;
      new_str?: string;
      old_str?: string;
      view_range?: [number, number];
    }) => {
      try {
        switch (command) {
          case "view":
            const content = await fs.readFile(filePath, "utf8");
            const lines = content.split("\n");

            if (view_range && view_range.length === 2) {
              const [start, end] = view_range;
              const viewLines = lines.slice(start - 1, end);
              return viewLines.join("\n");
            }

            return content;

          case "create":
            if (!file_text) {
              return "Error: file_text is required for create command";
            }

            // Ensure directory exists
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });

            await fs.writeFile(filePath, file_text, "utf8");
            return "success";

          case "str_replace":
            if (!old_str || new_str === undefined) {
              return "Error: old_str and new_str are required for str_replace command";
            }

            const existingContent = await fs.readFile(filePath, "utf8");

            if (!existingContent.includes(old_str)) {
              return "Error: old_str not found in file";
            }

            const replacedContent = existingContent.replace(old_str, new_str);
            await fs.writeFile(filePath, replacedContent, "utf8");
            return "success";

          case "insert":
            if (insert_line === undefined || new_str === undefined) {
              return "Error: insert_line and new_str are required for insert command";
            }

            const fileContent = await fs.readFile(filePath, "utf8");
            const fileLines = fileContent.split("\n");

            if (insert_line < 0 || insert_line > fileLines.length) {
              return "Error: insert_line is out of range";
            }

            fileLines.splice(insert_line, 0, new_str);
            await fs.writeFile(filePath, fileLines.join("\n"), "utf8");
            return "success";

          default:
            return `Error: Unknown command '${command}'`;
        }
      } catch (error) {
        if (error instanceof Error) {
          return `Error: ${error.message}`;
        }
        return "Error: Unknown error occurred";
      }
    },
  };
}
