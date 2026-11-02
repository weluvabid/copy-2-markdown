import type { RemovalPolicy } from '../types';

/**
 * Narrow class-based controls commonly rendered outside native button elements.
 * Keep this list deliberately small: framework class names are not reliable
 * evidence that an arbitrary container is disposable.
 */
export const frameworkUiPolicy: RemovalPolicy = {
  name: 'framework-ui',
  selectors: [
    '.copy-button',
    '.clipboard-btn',
    '.code-action-btn',
    '.copy-code-button',
    '.message-actions',
    '.response-actions',
    '.feedback-buttons',
    '.reaction-buttons',
    '.md-tooltip',
  ],
};
