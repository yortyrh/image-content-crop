import { GoogleGenAI } from '@google/genai';

const DEFAULT_MODEL = 'gemini-2.5-flash-image';

/**
 * Send a cropped image buffer + prompt to Gemini and return the modified image.
 * Requires the GEMINI_API_KEY environment variable.
 */
export async function processImageWithGemini(
  imageBuffer: Buffer,
  mimeType: string,
  prompt: string,
  model?: string,
): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY environment variable is required when Gemini processing is enabled.',
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelName = model ?? DEFAULT_MODEL;
  const base64Image = imageBuffer.toString('base64');

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [{ text: prompt }, { inlineData: { mimeType, data: base64Image } }],
    config: {
      responseModalities: ['IMAGE'],
    },
  });

  const candidates = response.candidates;
  if (!candidates?.length) {
    throw new Error('Gemini returned no candidates.');
  }

  const parts = candidates[0].content?.parts ?? [];

  for (const part of parts) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }

  const textReply = parts
    .filter((p) => p.text)
    .map((p) => p.text)
    .join('\n');
  const finishReason = candidates[0].finishReason ?? 'unknown';
  throw new Error(
    `Gemini did not return an image (finishReason: ${finishReason}).${textReply ? ` Model replied: ${textReply}` : ''}`,
  );
}
