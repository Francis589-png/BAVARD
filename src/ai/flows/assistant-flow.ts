
'use server';
/**
 * @fileOverview A flow for the JUSU AI assistant.
 *
 * - getAssistantResponse - A function that takes a user prompt and returns an AI-generated response.
 */

import { ai } from '@/ai/genkit';
import { AssistantInputSchema, AssistantOutputSchema, type AssistantInput } from '@/ai/schemas/assistant-schemas';
import { z } from 'zod';

export async function getAssistantResponse(input: AssistantInput): Promise<string> {
  const result = await assistantFlow(input);
  return result;
}

const prompt = ai.definePrompt({
  name: 'jusuAiAssistantPrompt',
  input: { schema: AssistantInputSchema },
  output: { schema: AssistantOutputSchema },
  prompt: `You are JUSU AI, a helpful and friendly assistant integrated into a chat application named BAVARD.

Your responses should be:
- Conversational and natural.
- Concise and to the point.
- Helpful and informative.
- Formatted with markdown for readability if the response involves lists, code, or multiple paragraphs.

Here is the recent conversation history. Use it to understand the context of the user's latest prompt.
{{#each history}}
{{#if (eq role 'user')}}
User: {{{content}}}
{{else}}
AI: {{{content}}}
{{/if}}
{{/each}}

User's new prompt: {{{prompt}}}
`,
});

const assistantFlow = ai.defineFlow(
  {
    name: 'assistantFlow',
    inputSchema: AssistantInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      return output?.response || "Sorry, I'm having trouble thinking right now. Please try again in a moment.";
    } catch (error) {
      console.error("Error in JUSU AI assistant flow:", error);
      return "I seem to be experiencing a technical difficulty. Please try again later.";
    }
  }
);
