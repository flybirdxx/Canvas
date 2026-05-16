## 2026-05-16 - Add aria-label to wrapper buttons
**Learning:** Found that custom wrapper button components (like `IconBtn` in `AlignmentToolbar.tsx`) that take a `title` for tooltips often miss the `aria-label` for screen readers. Since `title` is provided to describe the action, it can be seamlessly passed to `aria-label` to ensure the icon-only button is fully accessible.
**Action:** When auditing custom icon button wrappers, ensure that if a descriptive prop like `title` or `label` is provided, it is also forwarded to the underlying `aria-label` attribute.
