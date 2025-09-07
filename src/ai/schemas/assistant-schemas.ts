
/**
 * @fileOverview Zod schemas and TypeScript types for the JUSU AI assistant flow.
 */

import { z } from 'zod';

export const AssistantInputSchema = z.object({
  prompt: z.string().describe("The user's message or question to the assistant."),
});
export type AssistantInput = z.infer<typeof AssistantInputSchema>;


export const AssistantOutputSchema = z.object({
    response: z.string().describe("The AI assistant's response to the user's prompt."),
});
export type AssistantOutput = z.infer<typeof AssistantOutputSchema>;

  