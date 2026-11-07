# Page extraction and filtering

A webpage is not necessarily an article. Some pages are documentation, application interfaces,
reference material, or long-form content wrapped in framework components. Copy 2 Markdown uses a
primary article extractor and a separate fallback rather than assuming one page shape fits all.

## Page extraction

For a page-copy action, `src/content/extraction.ts` clones the document and passes the detached copy
to Mozilla Readability. The parser uses an 80-character text threshold and retains classes for the
subsequent conversion path.

When Readability returns content with enough text, that content is used. Otherwise, the extension
falls back to a cleaned clone of the page body and prefers a semantic content root in this order:

1. `main`
2. `article`
3. `[role="main"]`
4. The cleaned body, when none of those roots exists

The fallback has its own minimum text check. If neither path yields enough content, the action
returns a visible no-content error rather than copying an empty result.

The page title is prepended as an H1 only when the extracted HTML does not already contain an H1.
That avoids duplicating a heading already present in the article.

## Filtering is layered

Filtering policies are composed in `src/content/filtering/index.ts`:

- **Structural elements** remove content such as scripts, styles, templates, embedded objects,
  forms, and native controls that do not belong in copied reading material.
- **Semantic UI** removes explicitly interactive roles such as toolbars, menus, tab lists, and
  tooltips.
- **Framework UI** handles a deliberately narrow set of known interface patterns from common
  component and utility ecosystems.

The framework policies are split by concern under `src/content/filtering/framework/`. This keeps
framework-specific selectors visible and reviewable instead of hiding them in one broad selector
list.

A class name is not sufficient evidence that an entire element is disposable. The framework rules
are intentionally narrow because documentation pages often use the same frameworks for both
content and controls.

## Visually hidden content

Readability operates on a detached document and cannot inspect the live page's computed styles.
Before parsing, the extractor compares the live document with its clone and removes elements that
match the visually-hidden checks. The same cleanup is applied to the fallback clone.

The check considers computed visibility properties and the combined layout pattern used by common
visually-hidden utilities. Clipping, absolute positioning, a tiny box, or a familiar class name on
its own is not enough. Those techniques can also be used for visible effects and content.

## Selection extraction

Selection mode clones the browser's selected ranges into a temporary container. It does not run the
page-wide article extraction path and does not inject a selection toolbar or floating control.

If the browser selection is no longer available but a selection string was supplied with the action,
the text is safely inserted as text content. An empty selection produces an explicit error.

## Bounds and failure behaviour

Extracted HTML is limited to 5 MB. Oversized content is rejected before conversion. Empty or
insufficient page content and empty selections also produce explicit errors, which the extension
surfaces through its action feedback.

The extraction tests cover the page and selection paths, including fallback behaviour and filtering.
The website compatibility checks are part of the project's completed manual validation; this
document describes the implementation rather than treating that validation as an outstanding task.
