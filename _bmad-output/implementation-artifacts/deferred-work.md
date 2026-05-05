# Deferred Work

## Deferred from: code review of epic-2 (2026-05-05)

- **TopBar 两个切换按钮调用同一个 onToggleView**：视觉正确（accent 状态由 viewMode prop 驱动），但实现不直观。用户点击"分镜"按钮时调用 toggle 会先切到画布再切回来，实际结果是正确的。桌面端可接受。
- **textarea onBlur 在移动端的行为**：blur 事件在用户点击输入法候选词时也会触发（iOS/Android），导致意外保存。但画布是桌面优先场景，这是可接受的已知限制。

## Deferred from: code review of epic-1 (2026-05-05)

*(No deferred items from epic-1 review)*
