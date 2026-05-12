## 2026-05-12 - Added aria-labels to icon-only buttons
**Learning:** Relying solely on 'title' attributes is not sufficient for accessible names on buttons without visible text. It's an accessibility issue pattern for the FloatingActions and StatusBar components.
**Action:** Add explicit 'aria-label' attributes to all icon-only buttons to ensure they have an accessible name.
