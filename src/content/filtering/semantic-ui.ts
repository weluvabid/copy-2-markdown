import type { RemovalPolicy } from './types';

export const semanticUiPolicy: RemovalPolicy = {
  name: 'semantic-ui',
  selectors: [
    '[role="toolbar"]',
    '[role="menubar"]',
    '[role="menu"]',
    '[role="menuitem"]',
    '[role="tablist"]',
    '[role="progressbar"]',
    '[role="tooltip"]',
  ],
};
