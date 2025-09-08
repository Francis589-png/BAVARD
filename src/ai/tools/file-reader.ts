
'use server';
/**
 * @fileOverview A Genkit tool for reading file contents from the project.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

export const readFile = ai.defineTool(
  {
    name: 'readFile',
    description: 'Reads the content of a specified file from the project. Use this to understand the code before answering questions or providing suggestions.',
    inputSchema: z.object({
      filePath: z.string().describe('The relative path to the file from the project root (e.g., "src/components/chat-page.tsx").'),
    }),
    outputSchema: z.string(),
  },
  async ({ filePath }) => {
    try {
      // Prevent directory traversal attacks
      const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
      const fullPath = path.join(process.cwd(), safePath);

      // Check if the file is within the project directory
      if (!fullPath.startsWith(process.cwd())) {
        throw new Error("Access denied: Cannot read files outside of the project directory.");
      }
      
      const content = await fs.readFile(fullPath, 'utf-8');
      return content;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return `Error: File not found at path: ${filePath}`;
      }
      console.error(`Error reading file at ${filePath}:`, error);
      return `Error: Could not read file. ${error.message}`;
    }
  }
);
