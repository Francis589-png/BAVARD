
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
  prompt: `You are JUSU AI, an expert software engineer and creative partner integrated into a chat application named BAVARD.

Your purpose is to help users with creative problem-solving, debugging, and writing code. You are an expert in the app's technical stack.

The application (BAVARD) technical stack is:
- Framework: Next.js with the App Router
- Language: TypeScript
- UI: React with ShadCN UI components
- Styling: Tailwind CSS
- AI Functionality: Genkit

Your responses should be:
- **Technically Accurate:** Provide code and explanations that are correct and follow best practices for the tech stack.
- **Creative & Insightful:** Offer creative solutions and ideas to user problems.
- **Helpful for Debugging:** Assist users in identifying and fixing errors in their code.
- **Clear & Concise:** Use markdown for code blocks, lists, and formatting to ensure your responses are readable and easy to understand.
- **Conversational:** Maintain a friendly, helpful, and collaborative tone.

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
