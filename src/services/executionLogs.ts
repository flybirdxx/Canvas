// executionLogs.ts — Story 1.3: 全局执行日志服务
// 纯模块，无 React 依赖，executionEngine 和 RunPanel 均可安全导入

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  execId: string;
  nodeId?: string;
  level: LogLevel;
  message: string;
  timestamp: number;
}

const MAX_LOGS = 200;

let _logIdCounter = 0;
const _globalLogs: LogEntry[] = [];
const _logListeners = new Set<(logs: LogEntry[]) => void>();

export function appendLog(
  execId: string,
  level: LogLevel,
  message: string,
  nodeId?: string,
): void {
  const entry: LogEntry = {
    id: `log-${++_logIdCounter}`,
    execId,
    nodeId,
    level,
    message,
    timestamp: Date.now(),
  };
  _globalLogs.push(entry);
  if (_globalLogs.length > MAX_LOGS) {
    _globalLogs.splice(0, _globalLogs.length - MAX_LOGS);
  }
  _logListeners.forEach((fn) => fn([..._globalLogs]));
}

export function clearLogs(): void {
  _globalLogs.length = 0;
  _logListeners.forEach((fn) => fn([]));
}

export function subscribeLogs(listener: (logs: LogEntry[]) => void): () => void {
  _logListeners.add(listener);
  listener([..._globalLogs]);
  return () => { _logListeners.delete(listener); };
}

export function getAllLogs(): LogEntry[] {
  return [..._globalLogs];
}
