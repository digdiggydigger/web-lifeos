/** `Capture/CaptureValidation.swift`: trim, refuse empty, and normalise a link to an http(s) URL. */
import type { CaptureKind } from '@/domain/types';

export const DEFAULT_CAPTURE_KIND: CaptureKind = 'note';
export const EMPTY_CONTENT_ERROR = 'Capture content is required.';
export const INVALID_URL_ERROR = 'Enter a valid URL.';

export interface NormalizedCreateCaptureInput {
  readonly content: string;
  readonly kind: CaptureKind;
  readonly title: string | undefined;
  readonly lifeAreaId: string | undefined;
  readonly mediaKey: string | undefined;
  readonly mediaContentType: string | undefined;
}

export type CaptureValidationFailure = 'emptyContent' | 'invalidURL';

export type CreateCaptureValidation =
  | { readonly kind: 'ok'; readonly input: NormalizedCreateCaptureInput }
  | {
      readonly kind: 'failed';
      readonly reason: CaptureValidationFailure;
      readonly message: string;
    };

export function captureValidationMessage(reason: CaptureValidationFailure): string {
  return reason === 'emptyContent' ? EMPTY_CONTENT_ERROR : INVALID_URL_ERROR;
}

/** Adds `https://` when no scheme is present; only http and https with a non-empty host pass. */
export function normalizedLinkURLString(
  raw: string,
): { readonly ok: true; readonly url: string } | { readonly ok: false } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false };
  const withScheme = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
  if (/\s/.test(withScheme)) return { ok: false };
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { ok: false };
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.hostname.length === 0)
    return { ok: false };
  // Keep the user's spelling (URLComponents.string does not append a trailing slash to a bare host).
  return { ok: true, url: withScheme };
}

export function normalizeCreateCaptureInput(input: {
  readonly content: string;
  readonly kind: CaptureKind;
  readonly title?: string | undefined;
  readonly lifeAreaId?: string | undefined;
  readonly mediaKey?: string | undefined;
  readonly mediaContentType?: string | undefined;
}): CreateCaptureValidation {
  const trimmed = input.content.trim();
  let content: string;
  if (input.kind === 'link') {
    const link = normalizedLinkURLString(trimmed);
    if (!link.ok) return { kind: 'failed', reason: 'invalidURL', message: INVALID_URL_ERROR };
    content = link.url;
  } else {
    if (input.kind !== 'photo' && trimmed.length === 0)
      return { kind: 'failed', reason: 'emptyContent', message: EMPTY_CONTENT_ERROR };
    content = trimmed;
  }
  const title = input.title?.trim();
  return {
    kind: 'ok',
    input: {
      content,
      kind: input.kind,
      title: title ? title : undefined,
      lifeAreaId: input.lifeAreaId,
      mediaKey: input.mediaKey,
      mediaContentType: input.mediaContentType,
    },
  };
}
