---
title: 'Reset Zoom Button'
type: 'feature'
created: '2026-05-05'
status: 'done'
route: 'one-shot'
context: []
---

<!-- Target: 900–1300 tokens. Above 1600 = high risk of context rot.
     Never over-specify "how" — use boundaries + examples instead.
     Cohesive cross-layer stories (DB+BE+UI) stay in ONE file.
     IMPORTANT: Remove all HTML comments when filling this template. -->

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 用户缩放或平移画布后，没有快捷方式一键恢复到初始视图（scale=1, x=0, y=0）。

**Approach:** 在左下角 StatusBar 添加一个重置缩放按钮，附带 `Home` 键快捷键，两者均将 `stageConfig` 还原为 `{ scale: 1, x: 0, y: 0 }`。

## Boundaries & Constraints

**Always:** 还原到 `scale=1, x=0, y=0`（store 默认值），与初始画布状态一致

**Ask First:** 无

**Never:** 不做 fit-to-content（那是填充所有节点到视口，与"还原初始视图"语义不同）

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| BUTTON_AT_100_PCT | scale=1, x=0, y=0 → click reset | no-op (scale stays 1) | N/A |
| BUTTON_AFTER_ZOOM | scale=2.5 → click reset | scale→1, stage snaps to origin | N/A |
| BUTTON_AFTER_PAN | x=300, y=-150 → click reset | x→0, y→0 | N/A |
| KEY_AT_100_PCT | scale=1 → Home key | no-op | N/A |
| KEY_AFTER_ZOOM_PAN | scale=0.5, x=100, y=200 → Home | scale→1, x→0, y→0 | N/A |
| KEY_IN_INPUT | focus on text input → Home | ignored (keydown returns early) | N/A |

</frozen-after-approval>

## Code Map

- `src/components/StatusBar.tsx` -- 新增 RotateCcw 导入和重置按钮，调用 `setStageConfig({ scale: 1, x: 0, y: 0 })`
- `src/App.tsx` -- 新增 `e.key === 'Home'` 分支，通过 `useCanvasStore.getState().setStageConfig` 还原视图

## Tasks & Acceptance

**Execution:**
- [x] `src/components/StatusBar.tsx` -- 导入 `RotateCcw`，在缩放百分比右侧添加 CtrlBtn 重置视图按钮
- [x] `src/App.tsx` -- 添加 `e.key === 'Home'` 分支还原 `stageConfig`

**Acceptance Criteria:**
- Given 用户点击左下角重置按钮 when canvas is at any zoom/pan, then stage returns to scale=1 and origin
- Given 用户按下 `Home` 键 when canvas is at any zoom/pan, then stage returns to scale=1 and origin

## Spec Change Log

- 2026-05-05: Created — initial spec for reset zoom button feature

## Design Notes

无特殊设计决策。

## Verification

**Commands:**
- `npm run lint` -- expected: 0 errors, 0 warnings
