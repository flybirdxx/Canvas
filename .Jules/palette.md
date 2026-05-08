## 2026-05-08 - [Add ARIA labels to icon-only buttons]
**Learning:** [Many icon-only utility components in this project rely solely on `title` attributes for hints. `title` is primarily for sighted users hovering with a mouse and is not reliably announced by all screen readers, making these controls difficult to identify for keyboard-only or screen reader users.]
**Action:** [Always include an `aria-label` (or ensure there is screen-reader-only visible text) on icon-only buttons to guarantee accessibility across all assistive technologies.]
