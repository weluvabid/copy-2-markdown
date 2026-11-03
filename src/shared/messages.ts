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
  selectionText?: string;
}

export interface WriteClipboardRequest {
  type: 'WRITE_CLIPBOARD';
  text: string;
}

export interface OffscreenClipboardRequest {
  type: 'OFFSCREEN_WRITE_CLIPBOARD';
  text: string;
}

export interface SetActionIconThemeRequest {
  type: 'SET_ACTION_ICON_THEME';
  theme: 'light' | 'dark';
}

export interface ToastRequest {
  type: 'SHOW_TOAST';
  message: string;
  toastType: 'success' | 'error' | 'info';
}

export type ExtensionMessage =
  | ExtractRequest
  | CopyActionRequest
  | WriteClipboardRequest
  | OffscreenClipboardRequest
  | SetActionIconThemeRequest
  | ToastRequest;

export type ExtractResponse =
  | { ok: true; html: string; url: string }
  | { ok: false; error: string };

export interface CopyResponse {
  ok: boolean;
  error?: string;
}

export interface ClipboardResponse {
  ok: boolean;
  error?: string;
}
