import type { ApiErrorInfo } from '@google/genai';

const DEFAULT_MODEL = 'gemini-2.5-flash-image';

/** Default HTTP timeout for image generation (ms). Override with GEMINI_HTTP_TIMEOUT_MS. */
const DEFAULT_HTTP_TIMEOUT_MS = 300_000;

let _genaiModule: typeof import('@google/genai') | null = null;

async function loadGenAI() {
  if (!_genaiModule) {
    _genaiModule = await import('@google/genai');
  }
  return _genaiModule;
}

function sleepMs(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value == null || value === '') return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function resolveHttpTimeoutMs(): number {
  return parsePositiveInt(process.env.GEMINI_HTTP_TIMEOUT_MS, DEFAULT_HTTP_TIMEOUT_MS);
}

function resolveRetrySettings(): {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
} {
  return {
    maxAttempts: parsePositiveInt(process.env.GEMINI_RETRY_MAX_ATTEMPTS, 5),
    initialDelayMs: parsePositiveInt(process.env.GEMINI_RETRY_INITIAL_MS, 1000),
    maxDelayMs: parsePositiveInt(process.env.GEMINI_RETRY_MAX_MS, 60_000),
  };
}

function backoffDelayMs(attemptIndex: number, initialDelayMs: number, maxDelayMs: number): number {
  const base = initialDelayMs * 2 ** attemptIndex;
  const capped = Math.min(maxDelayMs, base);
  const jitter = Math.floor(Math.random() * Math.min(500, capped));
  return capped + jitter;
}

function isRetryableError(
  err: unknown,
  ApiErrorClass: new (options: ApiErrorInfo) => Error,
): boolean {
  if (err instanceof ApiErrorClass) {
    const s = (err as { status?: number }).status;
    if (s === 429) return true;
    if (typeof s === 'number' && s >= 500 && s < 600) return true;
    return false;
  }
  const code = (err as NodeJS.ErrnoException)?.code;
  return code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'EAI_AGAIN';
}

/**
 * Send a cropped image buffer + prompt to Gemini and return the modified image.
 * Requires the GEMINI_API_KEY environment variable.
 *
 * Retries with exponential backoff on HTTP 429, 5xx, and common transient network errors.
 * Tune via GEMINI_RETRY_MAX_ATTEMPTS, GEMINI_RETRY_INITIAL_MS, GEMINI_RETRY_MAX_MS.
 * HTTP timeout: GEMINI_HTTP_TIMEOUT_MS (default 5 minutes).
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

  const { GoogleGenAI, ApiError } = await loadGenAI();

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: resolveHttpTimeoutMs() },
  });
  const modelName = model ?? DEFAULT_MODEL;
  const base64Image = imageBuffer.toString('base64');

  const { maxAttempts, initialDelayMs, maxDelayMs } = resolveRetrySettings();

  let response: Awaited<ReturnType<typeof ai.models.generateContent>> | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      response = await ai.models.generateContent({
        model: modelName,
        contents: [{ text: prompt }, { inlineData: { mimeType, data: base64Image } }],
        config: {
          responseModalities: ['IMAGE'],
        },
      });
      break;
    } catch (err) {
      const lastAttempt = attempt === maxAttempts - 1;
      if (!isRetryableError(err, ApiError) || lastAttempt) {
        throw err;
      }
      await sleepMs(backoffDelayMs(attempt, initialDelayMs, maxDelayMs));
    }
  }

  if (!response) {
    throw new Error('Gemini: request failed after retries (internal misconfiguration).');
  }

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
