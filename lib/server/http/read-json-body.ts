import { NextRequest } from 'next/server';
import { z } from 'zod';

export class UnreadableJsonBodyError extends Error {
  constructor(cause: unknown) {
    super('Request body could not be read safely.', { cause });
    this.name = 'UnreadableJsonBodyError';
  }
}

/** Default ceiling for ordinary API commands. Larger endpoints opt in explicitly. */
export const DEFAULT_JSON_BODY_MAX_BYTES = 64 * 1024;

/** JSON media types accepted by RFC 8259 and structured syntax suffixes. */
const JSON_CONTENT_TYPE = /^(application\/json|application\/[a-z0-9!#$&^_.+-]+\+json)(?:\s*;|$)/i;

export class RequestBodyTooLargeError extends Error {
  constructor(public readonly maxBytes: number) {
    super('Request body exceeds the configured limit.');
    this.name = 'RequestBodyTooLargeError';
  }
}

export class UnsupportedJsonMediaTypeError extends Error {
  constructor(public readonly receivedContentType: string | null) {
    super('Request body must use a JSON media type.');
    this.name = 'UnsupportedJsonMediaTypeError';
  }
}

export class EmptyJsonBodyError extends Error {
  constructor() {
    super('Request body must not be empty.');
    this.name = 'EmptyJsonBodyError';
  }
}

export class InvalidContentLengthError extends Error {
  constructor() {
    super('Content-Length must be a non-negative integer when supplied.');
    this.name = 'InvalidContentLengthError';
  }
}

export class InvalidJsonEncodingError extends Error {
  constructor() {
    super('Request body must be UTF-8 encoded JSON.');
    this.name = 'InvalidJsonEncodingError';
  }
}

export interface JsonBodyOptions {
  /** Maximum decoded UTF-8 body bytes. Enforced while streaming, not after allocation. */
  maxBytes?: number;
  /** Require an explicit JSON content type. Defaults to true for command endpoints. */
  requireJsonContentType?: boolean;
}

function isJsonContentType(contentType: string | null) {
  return contentType !== null && JSON_CONTENT_TYPE.test(contentType.trim());
}

function parseDeclaredLength(req: NextRequest, maxBytes: number) {
  const rawLength = req.headers.get('content-length');
  if (rawLength === null) return;
  if (!/^\d+$/.test(rawLength.trim())) throw new InvalidContentLengthError();

  const declaredLength = Number(rawLength);
  if (!Number.isSafeInteger(declaredLength)) throw new InvalidContentLengthError();
  if (declaredLength > maxBytes) throw new RequestBodyTooLargeError(maxBytes);
}

async function readLimitedBody(req: NextRequest, maxBytes: number) {
  parseDeclaredLength(req, maxBytes);

  if (!req.body) return new Uint8Array();

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

async function readJsonValue(
  req: NextRequest,
  { maxBytes = DEFAULT_JSON_BODY_MAX_BYTES, requireJsonContentType = true }: JsonBodyOptions = {},
) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new RangeError('maxBytes must be a positive safe integer.');
  }
  if (requireJsonContentType && !isJsonContentType(req.headers.get('content-type'))) {
    throw new UnsupportedJsonMediaTypeError(req.headers.get('content-type'));
  }

  const bytes = await readLimitedBody(req, maxBytes);
  if (bytes.byteLength === 0) throw new EmptyJsonBodyError();

  // `fatal` rejects invalid UTF-8 instead of replacing bytes before JSON parsing.
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new InvalidJsonEncodingError();
  }
  return JSON.parse(text) as unknown;
}

/**
 * Shared command-body boundary. It validates transport before parsing and
 * validates the decoded value before application code sees it.
 */
export async function readJsonBody<TSchema extends z.ZodTypeAny>(
  req: NextRequest,
  schema: TSchema,
  options: JsonBodyOptions = {},
): Promise<z.infer<TSchema>> {
  try {
    return schema.parse(await readJsonValue(req, options));
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      error instanceof z.ZodError ||
      error instanceof RequestBodyTooLargeError ||
      error instanceof UnsupportedJsonMediaTypeError ||
      error instanceof EmptyJsonBodyError ||
      error instanceof InvalidContentLengthError ||
      error instanceof InvalidJsonEncodingError ||
      error instanceof RangeError
    ) {
      throw error;
    }

    throw new UnreadableJsonBodyError(error);
  }
}

/** Backwards-compatible convenience for the exceptional larger import boundary. */
export async function readBoundedJsonBody<TSchema extends z.ZodTypeAny>(
  req: NextRequest,
  schema: TSchema,
  maxBytes: number,
  options: Omit<JsonBodyOptions, 'maxBytes'> = {},
): Promise<z.infer<TSchema>> {
  return readJsonBody(req, schema, { ...options, maxBytes });
}

/**
 * Only a genuinely absent body receives the fallback. Malformed JSON and an
 * unsupported media type remain client errors; silent fallback hid mistakes.
 */
export async function readOptionalJsonBody<TSchema extends z.ZodTypeAny>(
  req: NextRequest,
  schema: TSchema,
  fallback: z.infer<TSchema>,
  options: JsonBodyOptions = {},
): Promise<z.infer<TSchema>> {
  try {
    return await readJsonBody(req, schema, {
      ...options,
      requireJsonContentType:
        options.requireJsonContentType ??
        (req.body !== null && req.headers.get('content-length') !== '0'),
    });
  } catch (error) {
    if (error instanceof EmptyJsonBodyError) return fallback;
    throw error;
  }
}
