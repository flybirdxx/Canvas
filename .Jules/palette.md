## 2024-05-06 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Several floating action, status bar, and top bar buttons rely solely on `title` attributes for tooltips, which aren't reliably read by all screen readers or exposed correctly in the accessibility tree. Icon-only buttons need explicit `aria-label`s.
**Action:** Always verify that icon-only buttons have an `aria-label` attribute complementing the `title` tooltip so they are fully accessible to assistive technologies.
