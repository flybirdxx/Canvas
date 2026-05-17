/**
 * dragOffsets — 拖拽期间节点在 Konva 层的实时偏移量。
 *
 * 问题：ConnectionLines 从 store.elements 读取节点位置来绘制贝塞尔曲线，
 *       但 CanvasElements 拖拽时直接操作 Konva 节点（e.target.position()），
 *       不更新 store —— 导致连线在拖拽过程中"冻结"在拖拽前的位置。
 *
 * 方案：CanvasElements 在 onDragMove 中将当前偏移写入此模块，
 *       ConnectionLines 在渲染时叠加偏移量 → 连线实时跟随。
 *       onDragEnd 时清除，此后回退到纯 store 位置。
 */
import { useSyncExternalStore } from 'react';

/** { nodeId → { dx, dy } } — 拖拽中的节点相对于其 store 位置的偏移 */
const _offsets = new Map<string, { dx: number; dy: number }>();
const _listeners = new Set<() => void>();
let _version = 0;

export function useDragOffsetsVersion() {
  return useSyncExternalStore(
    subscribeDragOffsets,
    getDragOffsetsSnapshot,
    getDragOffsetsSnapshot,
  );
}

function notifyDragOffsetsChanged() {
  _version += 1;
  for (const listener of _listeners) listener();
}

export function subscribeDragOffsets(listener: () => void) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

export function getDragOffsetsSnapshot() {
  return _version;
}

export function setDragOffset(nodeId: string, dx: number, dy: number) {
  _offsets.set(nodeId, { dx, dy });
  notifyDragOffsetsChanged();
}

export function getDragOffset(nodeId: string): { dx: number; dy: number } | undefined {
  return _offsets.get(nodeId);
}

export function clearDragOffset(nodeId: string) {
  if (_offsets.delete(nodeId)) notifyDragOffsetsChanged();
}

/** 拖拽编组时批量写入 */
export function setGroupDragOffsets(updates: { id: string; dx: number; dy: number }[]) {
  for (const u of updates) {
    _offsets.set(u.id, { dx: u.dx, dy: u.dy });
  }
  if (updates.length > 0) notifyDragOffsetsChanged();
}

/** 拖拽编组结束时批量清除 */
export function clearGroupDragOffsets(ids: string[]) {
  let changed = false;
  for (const id of ids) {
    changed = _offsets.delete(id) || changed;
  }
  if (changed) notifyDragOffsetsChanged();
}
