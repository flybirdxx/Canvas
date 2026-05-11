## 2024-05-14 - Aria-labels for icon buttons
**Learning:** Found several icon-only buttons across `TopBar`, `ToolDock`, and `GenerationHistoryPanel` that lacked `aria-label` attributes. This is a common pattern for icon-only buttons that rely on `title` attributes for tooltips but lack proper accessibility labels for screen readers.
**Action:** Always add `aria-label` to buttons containing only icons (like Lucide React icons) to ensure they are accessible to screen readers, even if they have `title` tooltips.
