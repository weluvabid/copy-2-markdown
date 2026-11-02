import type { RemovalPolicy } from './types';

export const structuralPolicy: RemovalPolicy = {
  name: 'structural',
  selectors: [
    'script',
    'style',
    'noscript',
    'template',
    'iframe',
    'object',
    'embed',
    'canvas',
    'form',
    'button',
    'input:not([type="checkbox"])',
    'select',
    'textarea',
    '[hidden]',
    '[inert]',
  ],
};
