# Clipboard and permissions

Copy 2 Markdown keeps page access and clipboard operations within extension-owned boundaries. The
manifest requests the permissions needed for user-invoked actions; it does not request persistent
host access.

## Permission model

| Permission       | Why it is present                                                            |
| ---------------- | ---------------------------------------------------------------------------- |
| `activeTab`      | Grants access to the active page after the user invokes an extension action. |
| `scripting`      | Injects the bundled content script into that active page on demand.          |
| `clipboardWrite` | Allows the extension to write the requested Markdown to the clipboard.       |
| `contextMenus`   | Registers page, selection, and link actions in the browser context menu.     |
| `offscreen`      | Creates the extension-owned document used for clipboard operations.          |

There are no persistent host permissions. The service worker checks the target URL before trying
to dispatch an extraction action. Browser-internal and otherwise restricted pages are rejected with
a visible error. Local file access is subject to Chrome's separate user-controlled file URL access
setting.

## Clipboard flow

Page and selection actions are extracted and converted in the content script. The resulting text is
sent through the shared clipboard helper. Link actions can be assembled by the service worker and
use the same extension-owned clipboard path.

The offscreen document contains a temporary textarea, selects the requested text, and calls the
clipboard copy command. It clears the buffer after the attempt and reports whether the write
succeeded. Clipboard access is not delegated to arbitrary page scripts.

## Feedback and errors

Successful actions show a confirmation in the page where the extension can display it, with an
extension badge fallback where appropriate. Failures are reported through the shared feedback path.
The extension does not treat a failed clipboard write as a successful copy.

## Local processing

The page content, selection, URL, and title needed for an action are processed locally to produce
the requested Markdown. Copy 2 Markdown does not send them to a developer-operated backend or
persist them on a developer-controlled service. The browser clipboard is changed only when a copy
action is invoked.

For the full data-practice statement, see the [privacy policy](../PRIVACY.md).
