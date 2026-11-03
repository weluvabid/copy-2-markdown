# Copy 2 Markdown Privacy Policy

**Effective date:** November 3, 2026

Copy 2 Markdown is a browser extension that converts webpage content, selected content, and links into Markdown for copying to the clipboard.

## Summary

Copy 2 Markdown processes the content you choose to copy locally in your browser. The extension does not operate an account system or its own remote processing service, and it does not include analytics or telemetry.

## Information the extension accesses

When you invoke an action, the extension may access the active tab's URL, title, selected content, and webpage DOM needed to extract and convert the requested content. For a link-copy action, it accesses the destination URL and link text when invoked on a link.

This information is processed locally in the browser to produce Markdown and write it to the clipboard. The extension does not send webpage content, URLs, selections, or clipboard output to a Copy 2 Markdown server.

Chrome itself manages extension installation, permissions, browser shortcuts, and any platform-level diagnostics or services independently of this extension.

## Storage and sharing

Copy 2 Markdown does not create an account, maintain a remote database, sell personal information, or share extension-accessed webpage content with the developer. The extension does not intentionally persist copied webpage content on a developer-controlled service.

The browser's clipboard is updated only when you invoke a copy action. Clipboard contents are subject to the browser and operating system's normal clipboard behaviour and controls.

## Permissions

- `activeTab`: access the current tab after you invoke an extension action.
- `scripting`: run the bundled extraction code in the active page when requested.
- `clipboardWrite`: place the resulting Markdown on the clipboard.
- `contextMenus`: provide page, selection, and link actions in the browser context menu.
- `offscreen`: use an extension-owned offscreen document for clipboard operations.

The extension does not request persistent host permissions.

## Changes to this policy

If the extension's data practices change, this policy will be updated before or alongside the relevant release. The effective date above will also be updated.

## Contact

For privacy questions or concerns, open an issue in the [Copy 2 Markdown GitHub repository](https://github.com/weluvabid/copy-2-markdown/issues).
