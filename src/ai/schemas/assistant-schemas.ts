
/**
 * @fileOverview Zod schemas and TypeScript types for the JUSU AI assistant flow.
 */

import { z } from 'zod';

export const MessageSchema = z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
});

export const AssistantInputSchema = z.object({
  prompt: z.string().describe("The user's message or question to the assistant."),
  history: z.array(MessageSchema).optional().describe("The previous messages in the conversation."),
});
export type AssistantInput = z.infer<typeof AssistantInputSchema>;
