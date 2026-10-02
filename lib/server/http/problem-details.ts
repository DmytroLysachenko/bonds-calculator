import { z } from 'zod';

import {
  getPublicCalculationErrorMessage,
  isCalculationDomainError,
} from '@/features/bond-core/errors';

import {
  EmptyJsonBodyError,
  InvalidContentLengthError,
  InvalidJsonEncodingError,
  RequestBodyTooLargeError,
  UnreadableJsonBodyError,
  UnsupportedJsonMediaTypeError,
} from './read-json-body';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  errors?: unknown;
  code?: string;
}

export function isJsonSyntaxError(error: unknown) {
  return error instanceof SyntaxError && /json/i.test(error.message);
}

export function createProblemDetails(
  problem: Omit<ProblemDetails, 'type'> & { type?: string },
): ProblemDetails {
  return {
    type:
      problem.type ??
      `https://api.obligacje.pl/errors/${problem.title.toLowerCase().replaceAll(' ', '-')}`,
    title: problem.title,
    status: problem.status,
    detail: problem.detail,
    errors: problem.errors,
    code: problem.code,
  };
}

export function mapApiErrorToProblemDetails(
  error: unknown,
  options: {
    includeInternalMessage?: boolean;
  } = {},
): ProblemDetails {
  if (error instanceof RequestBodyTooLargeError) {
    return createProblemDetails({
      type: 'https://api.obligacje.pl/errors/payload-too-large',
      title: 'Payload Too Large',
      status: 413,
      detail: "The request body exceeds this endpoint's size limit.",
      code: 'PAYLOAD_TOO_LARGE',
    });
  }

  if (error instanceof UnsupportedJsonMediaTypeError) {
    return createProblemDetails({
      type: 'https://api.obligacje.pl/errors/unsupported-media-type',
      title: 'Unsupported Media Type',
      status: 415,
      detail: 'The request body must use application/json.',
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  }

  if (
    error instanceof EmptyJsonBodyError ||
    error instanceof InvalidContentLengthError ||
    error instanceof InvalidJsonEncodingError ||
    error instanceof UnreadableJsonBodyError
  ) {
    return createProblemDetails({
      type: 'https://api.obligacje.pl/errors/invalid-request-body',
      title: 'Bad Request',
      status: 400,
      detail: 'The request body is invalid.',
      code: 'INVALID_REQUEST_BODY',
    });
  }

  if (error instanceof z.ZodError) {
    return createProblemDetails({
      type: 'https://api.obligacje.pl/errors/validation-failed',
      title: 'Bad Request',
      status: 400,
      detail: 'The request payload is invalid.',
      errors: error.issues,
      code: 'VALIDATION_ERROR',
    });
  }

  if (isJsonSyntaxError(error)) {
    return createProblemDetails({
      type: 'https://api.obligacje.pl/errors/malformed-json',
      title: 'Bad Request',
      status: 400,
      detail: 'The request body must be valid JSON.',
      code: 'MALFORMED_JSON',
    });
  }

  if (isCalculationDomainError(error)) {
    return createProblemDetails({
      type: 'https://api.obligacje.pl/errors/calculation-failed',
      title: 'Calculation Failed',
      status: 422,
      detail: getPublicCalculationErrorMessage(error),
      code: error.code,
      errors: error.details,
    });
  }

  return createProblemDetails({
    type: 'https://api.obligacje.pl/errors/internal-server-error',
    title: 'Internal Server Error',
    status: 500,
    detail:
      options.includeInternalMessage && error instanceof Error
        ? error.message
        : 'An unexpected internal error occurred. Please try again later.',
    code: 'INTERNAL_SERVER_ERROR',
  });
}
