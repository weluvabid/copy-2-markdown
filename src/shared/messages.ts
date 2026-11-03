export type ExtractionMode = 'page' | 'selection';
export type CopyAction = ExtractionMode | 'link';

export interface ExtractRequest {
  type: 'EXTRACT_CONTENT';
  mode: ExtractionMode;
}

export interface CopyActionRequest {
  type: 'COPY_ACTION';
  action: CopyAction;
  linkUrl?: string;
}

export type ExtensionMessage = ExtractRequest | CopyActionRequest;

export type ExtractResponse =
  | { ok: true; html: string; url: string }
  | { ok: false; error: string };

export interface CopyResponse {
  ok: boolean;
  error?: string;
}
