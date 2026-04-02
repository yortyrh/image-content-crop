import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGenerateContent, MockApiError } = vi.hoisted(() => {
  class ApiError extends Error {
    status: number;
    constructor(options: { message: string; status: number }) {
      super(options.message);
      this.name = 'ApiError';
      this.status = options.status;
      Object.setPrototypeOf(this, ApiError.prototype);
    }
  }
  return {
    mockGenerateContent: vi.fn(),
    MockApiError: ApiError,
  };
});

vi.mock('@google/genai', () => ({
  GoogleGenAI: class MockGoogleGenAI {
    models = { generateContent: mockGenerateContent };
  },
  ApiError: MockApiError,
}));

import { processImageWithGemini } from './gemini.js';

describe('processImageWithGemini', () => {
  const originalEnv = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
    delete process.env.GEMINI_RETRY_INITIAL_MS;
    delete process.env.GEMINI_RETRY_MAX_ATTEMPTS;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalEnv;
    }
  });

  it('throws when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(
      processImageWithGemini(Buffer.from('img'), 'image/png', 'edit this'),
    ).rejects.toThrow('GEMINI_API_KEY');
  });

  it('sends image + prompt and returns the resulting image buffer', async () => {
    const fakeOutputBase64 = Buffer.from('result-image').toString('base64');
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ inlineData: { data: fakeOutputBase64, mimeType: 'image/png' } }],
          },
        },
      ],
    });

    const input = Buffer.from('input-image');
    const prompt = 'Vary only non-text visuals; keep all written text unchanged. No new text.';
    const result = await processImageWithGemini(input, 'image/png', prompt);

    expect(result).toEqual(Buffer.from('result-image'));

    expect(mockGenerateContent).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash-image',
      contents: [
        { text: prompt },
        { inlineData: { mimeType: 'image/png', data: input.toString('base64') } },
      ],
      config: {
        responseModalities: ['IMAGE'],
      },
    });
  });

  it('uses a custom model when provided', async () => {
    const fakeOutputBase64 = Buffer.from('out').toString('base64');
    mockGenerateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ inlineData: { data: fakeOutputBase64 } }] } }],
    });

    await processImageWithGemini(Buffer.from('img'), 'image/jpeg', 'fix it', 'custom-model');

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'custom-model' }),
    );
  });

  it('throws when Gemini returns no candidates', async () => {
    mockGenerateContent.mockResolvedValue({ candidates: [] });

    await expect(processImageWithGemini(Buffer.from('img'), 'image/png', 'edit')).rejects.toThrow(
      'no candidates',
    );
  });

  it('throws when response contains no image', async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: 'Here is your image' }] } }],
    });

    await expect(processImageWithGemini(Buffer.from('img'), 'image/png', 'edit')).rejects.toThrow(
      'did not return an image',
    );
  });

  it('retries on 503 ApiError then succeeds', async () => {
    process.env.GEMINI_RETRY_INITIAL_MS = '5';
    const fakeOutputBase64 = Buffer.from('ok').toString('base64');
    mockGenerateContent
      .mockRejectedValueOnce(new MockApiError({ message: 'UNAVAILABLE', status: 503 }))
      .mockResolvedValueOnce({
        candidates: [
          { content: { parts: [{ inlineData: { data: fakeOutputBase64, mimeType: 'image/png' } }] } },
        ],
      });

    const result = await processImageWithGemini(Buffer.from('img'), 'image/png', 'edit');
    expect(result).toEqual(Buffer.from('ok'));
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('retries on 429 then succeeds', async () => {
    process.env.GEMINI_RETRY_INITIAL_MS = '5';
    const fakeOutputBase64 = Buffer.from('ok').toString('base64');
    mockGenerateContent
      .mockRejectedValueOnce(new MockApiError({ message: 'rate limit', status: 429 }))
      .mockResolvedValueOnce({
        candidates: [
          { content: { parts: [{ inlineData: { data: fakeOutputBase64, mimeType: 'image/png' } }] } },
        ],
      });

    await processImageWithGemini(Buffer.from('img'), 'image/png', 'edit');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 4xx other than 429', async () => {
    mockGenerateContent.mockRejectedValue(new MockApiError({ message: 'bad request', status: 400 }));

    await expect(processImageWithGemini(Buffer.from('img'), 'image/png', 'edit')).rejects.toThrow();
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('gives up after max retry attempts on 503', async () => {
    process.env.GEMINI_RETRY_INITIAL_MS = '5';
    process.env.GEMINI_RETRY_MAX_ATTEMPTS = '3';
    mockGenerateContent.mockRejectedValue(new MockApiError({ message: 'UNAVAILABLE', status: 503 }));

    await expect(processImageWithGemini(Buffer.from('img'), 'image/png', 'edit')).rejects.toThrow();
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  });
});
