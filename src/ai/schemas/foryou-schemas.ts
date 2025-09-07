/**
 * @fileOverview Zod schemas and TypeScript types for the ForYou feed AI flow.
 */

import { z } from 'zod';

const PostSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  userId: z.string(),
  likes: z.array(z.string()),
});

export const ForYouFeedInputSchema = z.object({
  userId: z.string().describe("The ID of the user for whom the feed is being generated."),
  posts: z.array(PostSchema).describe("A list of all available posts to be ranked."),
  contactIds: z.array(z.string()).describe("A list of user IDs that are in the current user's contacts."),
});
export type ForYouFeedInput = z.infer<typeof ForYouFeedInputSchema>;

export const ForYouFeedOutputSchema = z.object({
  rankedPostIds: z.array(z.string()).describe("A list of post IDs sorted in the recommended order for the user."),
});
export type ForYouFeedOutput = z.infer<typeof ForYouFeedOutputSchema>;
