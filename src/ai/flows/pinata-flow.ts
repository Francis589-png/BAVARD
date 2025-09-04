
'use server';
/**
 * @fileOverview A flow for uploading files to Pinata.
 *
 * - uploadFile - A function that handles the file upload process to Pinata.
 * - UploadFileInput - The input type for the uploadFile function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit/zod';

const UploadFileInputSchema = z.object({
  dataUri: z.string().describe("The file encoded as a data URI."),
  fileName: z.string().describe("The name of the file."),
});

export type UploadFileInput = z.infer<typeof UploadFileInputSchema>;

export async function uploadFile(input: UploadFileInput): Promise<string> {
  return uploadFileFlow(input);
}

const uploadFileFlow = ai.defineFlow(
  {
    name: 'uploadFileFlow',
    inputSchema: UploadFileInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt) {
        throw new Error("Pinata JWT not found in environment variables.");
    }

    const data = Buffer.from(input.dataUri.split(',')[1], 'base64');
    
    const formData = new FormData();
    formData.append('file', new Blob([data]), input.fileName);

    const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${pinataJwt}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinata API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    return result.IpfsHash;
  }
);
