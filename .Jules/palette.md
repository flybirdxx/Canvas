## 2024-05-10 - Title vs ARIA Label for Icon-Only Buttons
**Learning:** Found that `FloatingActions.tsx` contained icon-only buttons using only the `title` attribute for accessibility. While `title` gives a hover tooltip, it is not consistently announced by screen readers as the accessible name for buttons. Screen readers prefer `aria-label` for reliable identification.
**Action:** Always ensure icon-only buttons have an explicit `aria-label` attribute in addition to `title` (if a tooltip is desired) to ensure both sighted mouse users and screen reader users have a good experience.
