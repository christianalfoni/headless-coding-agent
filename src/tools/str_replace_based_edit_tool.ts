import { anthropic } from "@ai-sdk/anthropic";
import * as fs from "fs/promises";
import * as path from "path";

export const str_replace_based_edit_tool = anthropic.tools.textEditor_20250429({
  execute: async ({
    command,
    path: filePath,
    file_text,
    insert_line,
    new_str,
    old_str,
    view_range,
  }) => {
    try {
      switch (command) {
        case 'view':
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.split('\n');
          
          if (view_range && view_range.length === 2) {
            const [start, end] = view_range;
            const viewLines = lines.slice(start - 1, end);
            return viewLines.join('\n');
          }
          
          return content;

        case 'create':
          if (!file_text) {
            return "Error: file_text is required for create command";
          }
          
          // Ensure directory exists
          const dir = path.dirname(filePath);
          await fs.mkdir(dir, { recursive: true });
          
          await fs.writeFile(filePath, file_text, 'utf8');
          return "success";

        case 'str_replace':
          if (!old_str || new_str === undefined) {
            return "Error: old_str and new_str are required for str_replace command";
          }
          
          const existingContent = await fs.readFile(filePath, 'utf8');
          
          if (!existingContent.includes(old_str)) {
            return "Error: old_str not found in file";
          }
          
          const replacedContent = existingContent.replace(old_str, new_str);
          await fs.writeFile(filePath, replacedContent, 'utf8');
          return "success";

        case 'insert':
          if (insert_line === undefined || new_str === undefined) {
            return "Error: insert_line and new_str are required for insert command";
          }
          
          const fileContent = await fs.readFile(filePath, 'utf8');
          const fileLines = fileContent.split('\n');
          
          if (insert_line < 0 || insert_line > fileLines.length) {
            return "Error: insert_line is out of range";
          }
          
          fileLines.splice(insert_line, 0, new_str);
          await fs.writeFile(filePath, fileLines.join('\n'), 'utf8');
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
});