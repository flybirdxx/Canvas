import React, { useState, useEffect } from 'react';
import { Html } from 'react-konva-utils';
import { useExecutionStore, type ExecutionRun } from '@/store/useExecutionStore';

/**
 * AC2.6: 运行中节点的绿色脉冲动画覆盖层。
 *
 * 当节点处于 execution engine 的 'running' 状态时，在节点四周
 * 渲染一个 CSS-animated 的绿色呼吸光晕，提示用户"这里正在工作"。
 *
 * 动画规格：
 *   - 颜色：--signal 系列（#52C41A，与 audio port 绿色同源）
 *   - 效果：border + box-shadow 的 opacity 呼吸（1s 周期）
 *   - 插入：2px 外扩，不挤占节点内容空间
 *   - 性能：仅 running 状态渲染 DOM，其他状态返回 null
 */

const PULSE_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: -4,
  borderRadius: 14,
  border: '2px solid rgba(82, 196, 26, 0.6)',
  boxShadow: '0 0 12px 2px rgba(82, 196, 26, 0.35)',
  pointerEvents: 'none',
  animation: 'canvas-running-pulse 1s ease-in-out infinite',
  zIndex: 2,
};

export function useRunningStatus(nodeId: string): boolean {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const check = (run: ExecutionRun | undefined) => {
      const ns = run?.nodeStates?.[nodeId];
      setStatus(ns?.status ?? null);
    };
    check(useExecutionStore.getState().getActiveRun());
    const unsub = useExecutionStore.subscribe((state) => {
      check(state.runs.length > 0 ? state.runs[state.runs.length - 1] : undefined);
    });
    return unsub;
  }, [nodeId]);

  return status === 'running';
}

export function RunningPulse({ el }: { el: { id: string; width: number; height: number } }) {
  const running = useRunningStatus(el.id);

  if (!running) return null;

  return (
    <Html divProps={{ style: { pointerEvents: 'none' } }}>
      <div style={{ ...PULSE_STYLE, width: el.width, height: el.height }} />
      <style>{`
        @keyframes canvas-running-pulse {
          0%, 100% { opacity: 0.65; }
          50%      { opacity: 1.0; }
        }
      `}</style>
    </Html>
  );
}
