import { describe, expect, it } from 'vitest';
import {
  getPageSupport,
  isCopyablePageLink,
  isCopyableTargetLink,
} from '../../src/shared/page-support';

describe('getPageSupport', () => {
  it.each(['https://example.com/article', 'http://localhost:3000'])(
    'supports web pages: %s',
    (url) => {
      expect(getPageSupport(url)).toBe('supported');
    },
  );

  it('supports local files only when the user grants file URL access', () => {
    expect(getPageSupport('file:///Users/test/notes.html')).toBe('file-access-required');
    expect(getPageSupport('file:///Users/test/notes.html', true)).toBe('supported');
  });

  it.each([
    'chrome://settings/appearance',
    'chrome://extensions',
    'chrome-extension://abcdefghijklmnop/popup.html',
    'about:blank',
    'data:text/html,hello',
    'blob:https://example.com/id',
    'https://chromewebstore.google.com/detail/example',
    'https://chrome.google.com/webstore/detail/example',
    undefined,
  ])('rejects unsupported page URLs: %s', (url) => {
    expect(getPageSupport(url)).toBe('unsupported');
  });
});

describe('link URL validation', () => {
  it('allows ordinary web and local-file page links', () => {
    expect(isCopyablePageLink('https://example.com')).toBe(true);
    expect(isCopyablePageLink('http://localhost:3000')).toBe(true);
    expect(isCopyablePageLink('file:///Users/test/notes.html')).toBe(true);
  });

  it('rejects browser-internal and executable page URLs', () => {
    expect(isCopyablePageLink('chrome://settings')).toBe(false);
    expect(isCopyablePageLink('javascript:alert(1)')).toBe(false);
    expect(isCopyablePageLink('data:text/html,hello')).toBe(false);
  });

  it('allows safe link targets including mail and telephone links', () => {
    expect(isCopyableTargetLink('https://example.com')).toBe(true);
    expect(isCopyableTargetLink('file:///Users/test/notes.html')).toBe(true);
    expect(isCopyableTargetLink('mailto:hello@example.com')).toBe(true);
    expect(isCopyableTargetLink('tel:+15551234567')).toBe(true);
  });

  it('rejects executable link targets', () => {
    expect(isCopyableTargetLink('javascript:alert(1)')).toBe(false);
    expect(isCopyableTargetLink('data:text/html,hello')).toBe(false);
  });
});
