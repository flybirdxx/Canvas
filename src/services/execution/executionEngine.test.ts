import { describe, it, expect } from 'vitest';
import { topologicalSort } from '@/services/executionEngine';
import type { Connection } from '@/types/canvas';

/**
 * Helper: create a minimal connection for testing.
 */
function conn(fromId: string, toId: string, id = `${fromId}->${toId}`): Connection {
  return {
    id,
    fromId,
    toId,
    fromPortId: 'out',
    toPortId: 'in',
  };
}

describe('topologicalSort', () => {
  it('should return an empty array for an empty node list', () => {
    const result = topologicalSort([], []);
    expect(result).toEqual([]);
  });

  it('should return a single level for a single node with no connections', () => {
    const result = topologicalSort(['n1'], []);
    expect(result).toEqual([['n1']]);
  });

  it('should order two chained nodes into two levels', () => {
    // n1 → n2
    const result = topologicalSort(['n1', 'n2'], [conn('n1', 'n2')]);
    expect(result).toEqual([['n1'], ['n2']]);
  });

  it('should put independent nodes in the same level', () => {
    // n1 and n2 have no dependencies; both at level 0
    const result = topologicalSort(['n1', 'n2'], []);
    // Both should be in the same level (order within level not guaranteed)
    expect(result).toHaveLength(1);
    expect(result![0]).toHaveLength(2);
    expect(result![0]).toEqual(expect.arrayContaining(['n1', 'n2']));
  });

  it('should handle a linear chain of three nodes', () => {
    // n1 → n2 → n3
    const result = topologicalSort(['n1', 'n2', 'n3'], [
      conn('n1', 'n2'),
      conn('n2', 'n3'),
    ]);
    expect(result).toEqual([['n1'], ['n2'], ['n3']]);
  });

  it('should handle a diamond dependency', () => {
    // n1 → n2, n3
    // n2, n3 → n4
    const result = topologicalSort(['n1', 'n2', 'n3', 'n4'], [
      conn('n1', 'n2'),
      conn('n1', 'n3'),
      conn('n2', 'n4'),
      conn('n3', 'n4'),
    ]);
    expect(result).toHaveLength(3);
    expect(result![0]).toEqual(['n1']);
    expect(result![1]).toEqual(expect.arrayContaining(['n2', 'n3']));
    expect(result![2]).toEqual(['n4']);
  });

  it('should return null for a simple cycle (2 nodes)', () => {
    // n1 → n2 → n1
    const result = topologicalSort(['n1', 'n2'], [
      conn('n1', 'n2'),
      conn('n2', 'n1'),
    ]);
    expect(result).toBeNull();
  });

  it('should return null for a 3-node cycle', () => {
    // n1 → n2 → n3 → n1
    const result = topologicalSort(['n1', 'n2', 'n3'], [
      conn('n1', 'n2'),
      conn('n2', 'n3'),
      conn('n3', 'n1'),
    ]);
    expect(result).toBeNull();
  });

  it('should ignore connections that reference nodes outside the set', () => {
    // n1 → n2, but n3 is not in the set — the connection should be ignored
    // and n2 should still appear at level 0 since n1 is not connected to it
    const result = topologicalSort(['n2'], [conn('n1', 'n2')]);
    expect(result).toEqual([['n2']]);
  });

  it('should handle disconnected subsets of nodes', () => {
    // n1 → n2, n3 → n4 (no connection between the two chains)
    const result = topologicalSort(['n1', 'n2', 'n3', 'n4'], [
      conn('n1', 'n2'),
      conn('n3', 'n4'),
    ]);
    expect(result).toHaveLength(2);
    // Both n1 and n3 are roots → same level
    expect(result![0]).toEqual(expect.arrayContaining(['n1', 'n3']));
    expect(result![0]).toHaveLength(2);
    // Both n2 and n4 are leaves → same level
    expect(result![1]).toEqual(expect.arrayContaining(['n2', 'n4']));
    expect(result![1]).toHaveLength(2);
  });

  it('should handle a self-loop (node connecting to itself)', () => {
    // n1 → n1 is a cycle
    const result = topologicalSort(['n1'], [conn('n1', 'n1')]);
    expect(result).toBeNull();
  });

  it('should handle a node list reordered from the connection order', () => {
    // The node IDs array order should not matter
    const result = topologicalSort(['n3', 'n1', 'n2'], [
      conn('n1', 'n2'),
      conn('n2', 'n3'),
    ]);
    expect(result).toEqual([['n1'], ['n2'], ['n3']]);
  });
});
