
'use server';
/**
 * @fileOverview A flow for creating a personalized "For You" feed using AI.
 *
 * - getForYouFeed - A function that takes a user and posts and returns a ranked list of post IDs.
 */

import { ai } from '@/ai/genkit';
import { ForYouFeedInputSchema, ForYouFeedOutputSchema, type ForYouFeedInput, type ForYouFeedOutput } from '@/ai/schemas/foryou-schemas';

export async function getForYouFeed(input: ForYouFeedInput): Promise<ForYouFeedOutput> {
  return forYouFeedFlow(input);
}

const prompt = ai.definePrompt({
  name: 'forYouFeedPrompt',
  input: { schema: ForYouFeedInputSchema },
  output: { schema: ForYouFeedOutputSchema },
  prompt: `You are an expert social media ranking algorithm. Your goal is to create a personalized "For You" feed for a specific user.

You will be given the user's ID, a list of their contact's IDs, and a list of all available posts.

Rank the posts based on the following criteria, from most important to least important:
1.  **Posts from Contacts:** Posts created by users in the 'contactIds' list should be prioritized.
2.  **Engagement:** Posts with a higher number of likes should be ranked higher.
3.  **Content (Implicit):** The titles and descriptions of the posts should be considered, but direct contact and like count are more important for this version of the algorithm.

Return a JSON object containing a single key "rankedPostIds", which is an array of post IDs sorted in the order you recommend they appear in the user's feed.

User ID: {{{userId}}}
Contact IDs:
{{#each contactIds}}
- {{{this}}}
{{/each}}

Available Posts (JSON):
{{{json posts}}}
`,
});

const forYouFeedFlow = ai.defineFlow(
  {
    name: 'forYouFeedFlow',
    inputSchema: ForYouFeedInputSchema,
    outputSchema: ForYouFeedOutputSchema,
  },
  async (input) => {
    // If there are no posts, return an empty array to avoid calling the AI.
    if (input.posts.length === 0) {
      return { rankedPostIds: [] };
    }

    const { output } = await prompt(input);
    return output!;
  }
);
