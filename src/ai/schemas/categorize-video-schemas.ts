/**
 * @fileOverview Zod schemas and TypeScript types for the video categorization AI flow.
 */

import { z } from 'zod';

export const CategorizeVideoInputSchema = z.object({
  videoDataUri: z
    .string()
    .describe(
      "A video file, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type CategorizeVideoInput = z.infer<typeof CategorizeVideoInputSchema>;


export const CategorizeVideoOutputSchema = z.object({
    categories: z.array(z.string()).describe("A list of 1-3 word categories that describe the video content."),
});
export type CategorizeVideoOutput = z.infer<typeof CategorizeVideoOutputSchema>;
