'use server';
/**
 * @fileOverview An AI flow for categorizing video content.
 *
 * - categorizeVideo - A function that takes a video and returns a list of categories.
 */

import { ai } from '@/ai/genkit';
import {
    CategorizeVideoInputSchema,
    CategorizeVideoOutputSchema,
    type CategorizeVideoInput,
    type CategorizeVideoOutput
} from '@/ai/schemas/categorize-video-schemas';


export async function categorizeVideo(input: CategorizeVideoInput): Promise<CategorizeVideoOutput> {
  return categorizeVideoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'categorizeVideoPrompt',
  input: { schema: CategorizeVideoInputSchema },
  output: { schema: CategorizeVideoOutputSchema },
  prompt: `You are an expert video content analyst. Your task is to analyze the provided video and generate a list of relevant categories that accurately describe its content.

Analyze the video frames and identify the main subjects, themes, and overall tone.

Based on your analysis, provide a list of 1 to 5 categories. Each category should be a short phrase, typically 1-3 words (e.g., "Nature Documentary", "Comedy Sketch", "DIY Tutorial", "Travel Vlog").

Video for analysis:
{{media url=videoDataUri}}
`,
});

const categorizeVideoFlow = ai.defineFlow(
  {
    name: 'categorizeVideoFlow',
    inputSchema: CategorizeVideoInputSchema,
    outputSchema: CategorizeVideoOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
