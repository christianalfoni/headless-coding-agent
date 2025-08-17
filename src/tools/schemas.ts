import { z } from "zod";

// Universal input schema for all tools - acts like command-line parameters
export const universalInputSchema = z.object({
  input: z.string().describe("Parameters and flags for the tool command")
});

// Export the schema for reuse
export { universalInputSchema as inputSchema };