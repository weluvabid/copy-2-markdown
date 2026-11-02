export type ExtractionMode = 'page' | 'selection';

export interface ExtractRequest {
  type: 'EXTRACT_CONTENT';
  mode: ExtractionMode;
}

export type ExtractResponse =
  | { ok: true; html: string; url: string }
  | { ok: false; error: string };
