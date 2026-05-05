/**
 * FR1: 对齐吸附算法纯函数。
 *
 * 扫描画布上所有其他节点，计算被拖拽/缩放节点的最佳吸附偏移量和参考线。
 * 算法优先级：边缘对齐 > 中心对齐 > 等间距对齐。距离相等时取边缘。
 */

import type { CanvasElement } from '../types/canvas';

/** 参考线类型 */
export interface GuideLine {
  /** 'vertical' = 纵向参考线（coord=X，from/to=Y轴范围）；'horizontal' = 横向（coord=Y，from/to=X轴范围） */
  orientation: 'vertical' | 'horizontal';
  /** 纵向线的 X 坐标，或横向线的 Y 坐标（canvas-space） */
  coord: number;
  /** 线段范围的起始坐标（canvas-space，另一轴的最小值） */
  from: number;
  /** 线段范围的结束坐标（canvas-space，另一轴的最大值） */
  to: number;
  /** 等间距参考线显示的数值标签（可选） */
  label?: string;
}

/** 吸附结果 */
export interface SnapResult {
  /** 吸附后的节点 x 偏移（canvas-space） */
  snapDx: number;
  /** 吸附后的节点 y 偏移（canvas-space） */
  snapDy: number;
  /** 要渲染的参考线列表 */
  guideLines: GuideLine[];
}

/** 吸附阈值（px） */
const THRESHOLD = 4;

function nodeEdges(el: CanvasElement) {
  return {
    left: el.x,
    right: el.x + el.width,
    top: el.y,
    bottom: el.y + el.height,
    cx: el.x + el.width / 2,
    cy: el.y + el.height / 2,
  };
}

/**
 * 计算被拖拽/缩放节点的最佳吸附偏移量。
 *
 * @param draggingId - 被拖拽节点的 ID
 * @param allElements - 画布上所有节点
 * @param dx - 相对拖拽起点（canvas-space）的 X 偏移
 * @param dy - 相对拖拽起点（canvas-space）的 Y 偏移
 * @param width - 拖拽/缩放后的节点宽度
 * @param height - 拖拽/缩放后的节点高度
 * @param originX - 拖拽起点的 canvas X
 * @param originY - 拖拽起点的 canvas Y
 */
export function findSnapTargets(
  draggingId: string,
  allElements: CanvasElement[],
  dx: number,
  dy: number,
  width: number,
  height: number,
  originX: number,
  originY: number,
): SnapResult {
  const candidates: Array<{
    dist: number;
    snapDx: number;
    snapDy: number;
    guideLines: GuideLine[];
    priority: number;
  }> = [];

  // 被拖拽节点在 canvas-space 的当前几何
  const curLeft = originX + dx;
  const curTop = originY + dy;
  const curRight = curLeft + width;
  const curBottom = curTop + height;
  const curCx = curLeft + width / 2;
  const curCy = curTop + height / 2;

  for (const other of allElements) {
    if (other.id === draggingId) continue;

    const e = nodeEdges(other);

    // ── 边缘对齐 ──────────────────────────────────────────────
    // 水平方向（Y 不变，吸附 X）
    {
      const pairs: Array<[number, number, GuideLine]> = [
        // A左边缘 ↔ B右边缘
        [curLeft,  e.right, { orientation: 'vertical', coord: e.right, from: Math.min(curTop, e.top),  to: Math.max(curBottom, e.bottom) }],
        // A右边缘 ↔ B左边缘
        [curRight, e.left,  { orientation: 'vertical', coord: e.left,  from: Math.min(curTop, e.top),  to: Math.max(curBottom, e.bottom) }],
        // A左边缘 ↔ B左边缘
        [curLeft,  e.left,  { orientation: 'vertical', coord: e.left,  from: Math.min(curTop, e.top),  to: Math.max(curBottom, e.bottom) }],
        // A右边缘 ↔ B右边缘
        [curRight, e.right, { orientation: 'vertical', coord: e.right, from: Math.min(curTop, e.top),  to: Math.max(curBottom, e.bottom) }],
      ];
      for (const [a, b, gl] of pairs) {
        const dist = Math.abs(a - b);
        if (dist <= THRESHOLD) {
          const offset = b - a;
          candidates.push({ dist, snapDx: offset, snapDy: 0, guideLines: [gl], priority: 0 });
        }
      }
    }

    // 垂直方向（X 不变，吸附 Y）
    {
      const pairs: Array<[number, number, GuideLine]> = [
        [curTop,    e.bottom, { orientation: 'horizontal', coord: e.bottom, from: Math.min(curLeft, e.left),  to: Math.max(curRight, e.right) }],
        [curBottom, e.top,    { orientation: 'horizontal', coord: e.top,    from: Math.min(curLeft, e.left),  to: Math.max(curRight, e.right) }],
        [curTop,    e.top,    { orientation: 'horizontal', coord: e.top,    from: Math.min(curLeft, e.left),  to: Math.max(curRight, e.right) }],
        [curBottom, e.bottom, { orientation: 'horizontal', coord: e.bottom, from: Math.min(curLeft, e.left),  to: Math.max(curRight, e.right) }],
      ];
      for (const [a, b, gl] of pairs) {
        const dist = Math.abs(a - b);
        if (dist <= THRESHOLD) {
          const offset = b - a;
          candidates.push({ dist, snapDx: 0, snapDy: offset, guideLines: [gl], priority: 0 });
        }
      }
    }

    // ── 中心对齐 ──────────────────────────────────────────────
    // 水平中心对齐 Y 轴
    {
      const dist = Math.abs(curCy - e.cy);
      if (dist <= THRESHOLD) {
        const offset = e.cy - curCy;
        candidates.push({
          dist,
          snapDx: 0,
          snapDy: offset,
          guideLines: [{ orientation: 'horizontal', coord: e.cy, from: Math.min(curLeft, e.left), to: Math.max(curRight, e.right) }],
          priority: 1,
        });
      }
    }
    // 垂直中心对齐 X 轴
    {
      const dist = Math.abs(curCx - e.cx);
      if (dist <= THRESHOLD) {
        const offset = e.cx - curCx;
        candidates.push({
          dist,
          snapDx: offset,
          snapDy: 0,
          guideLines: [{ orientation: 'vertical', coord: e.cx, from: Math.min(curTop, e.top), to: Math.max(curBottom, e.bottom) }],
          priority: 1,
        });
      }
    }

    // ── 等间距对齐 ────────────────────────────────────────────
    // Early return: need at least 2 other nodes to form an equal-spacing candidate pool.
    // Only skip the equal-spacing section, NOT the edge/center alignment above it.
    if (allElements.length < 2) {
      // Fall through to return the best edge/center candidate computed above.
    } else {
      const others = allElements.filter(o => o.id !== draggingId);
      // 收集所有节点的 top 和 bottom，排序后找相邻间距
      const ys: number[] = [];
      for (const o of others) {
        ys.push(o.y);
        ys.push(o.y + o.height);
      }
      ys.sort((a, b) => a - b);

      // 扫描 draggingNode 的 top/bottom 是否落在已有间距的等分点
      for (let i = 0; i < ys.length - 1; i++) {
        const gap = ys[i + 1] - ys[i];
        if (gap > 0) {
          // 尝试将 curTop 对齐到 ys[i] + n*gap
          for (const y0 of [ys[i], ys[i + 1] - height]) {
            const dist = Math.abs(curTop - y0);
            if (dist <= THRESHOLD) {
              const offset = y0 - curTop;
              const spacingLabel = `${Math.round(gap)}px`;
              candidates.push({
                dist,
                snapDx: 0,
                snapDy: offset,
                guideLines: [
                  { orientation: 'horizontal', coord: y0, from: curLeft, to: curRight, label: spacingLabel },
                  { orientation: 'horizontal', coord: y0 + gap, from: curLeft, to: curRight },
                ],
                priority: 2,
              });
            }
          }
        }
      }

      // 同样扫描水平间距
      const xs: number[] = [];
      for (const o of others) {
        xs.push(o.x);
        xs.push(o.x + o.width);
      }
      xs.sort((a, b) => a - b);

      for (let i = 0; i < xs.length - 1; i++) {
        const gap = xs[i + 1] - xs[i];
        if (gap > 0) {
          for (const x0 of [xs[i], xs[i + 1] - width]) {
            const dist = Math.abs(curLeft - x0);
            if (dist <= THRESHOLD) {
              const offset = x0 - curLeft;
              const spacingLabel = `${Math.round(gap)}px`;
              candidates.push({
                dist,
                snapDx: offset,
                snapDy: 0,
                guideLines: [
                  { orientation: 'vertical', coord: x0, from: curTop, to: curBottom, label: spacingLabel },
                  { orientation: 'vertical', coord: x0 + gap, from: curTop, to: curBottom },
                ],
                priority: 2,
              });
            }
          }
        }
      }
    }
  }

  if (candidates.length === 0) {
    return { snapDx: 0, snapDy: 0, guideLines: [] };
  }

  // 按 priority 升序（0=边缘优先）、dist 升序（距离最小优先）排序
  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.dist - b.dist;
  });

  return {
    snapDx: candidates[0].snapDx,
    snapDy: candidates[0].snapDy,
    guideLines: candidates[0].guideLines,
  };
}
