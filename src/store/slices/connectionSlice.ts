/**
 * ConnectionSlice — connection CRUD with cycle detection.
 */
import type { StateCreator } from 'zustand';
import type { Connection } from '@/types/canvas';
import type { CanvasState } from '@/store/types';
import { snapshot, MAX_HISTORY } from '@/store/helpers';

export interface ConnectionSlice {
  connections: Connection[];
  addConnection: (connection: Connection) => void;
  deleteConnections: (ids: string[]) => void;
}

export const createConnectionSlice: StateCreator<CanvasState, [], [], ConnectionSlice> = (set) => ({
  connections: [],

  addConnection: (connection) => set((state) => {
    // Cycle detection: DFS from toId along all connections. If fromId is
    // reachable, adding this connection would create a directed cycle.
    {
      const allCons = [
        ...state.connections.filter(c => c.toPortId !== connection.toPortId),
        connection,
      ];
      const visited = new Set<string>();
      const stack = [connection.toId];
      while (stack.length > 0) {
        const cur = stack.pop()!;
        if (cur === connection.fromId) return state;
        if (visited.has(cur)) continue;
        visited.add(cur);
        for (const c of allCons) {
          if (c.fromId === cur && !visited.has(c.toId)) {
            stack.push(c.toId);
          }
        }
      }
    }

    const filteredConnections = state.connections.filter(
      c => c.toPortId !== connection.toPortId,
    );

    return {
      past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
      future: [],
      connections: [...filteredConnections, connection],
      currentLabel: '添加连线',
      currentTimestamp: Date.now(),
      _coalesceKey: undefined,
      _coalesceAt: undefined,
    };
  }),

  deleteConnections: (ids) => set((state) => ({
    past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
    future: [],
    connections: state.connections.filter((conn) => !ids.includes(conn.id)),
    currentLabel: `删除 ${ids.length} 条连线`,
    currentTimestamp: Date.now(),
    _coalesceKey: undefined,
    _coalesceAt: undefined,
  })),
});
