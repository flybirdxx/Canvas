// executionSession.ts �� owned mutable session state for the execution engine
// Extracted from executionEngine.ts. Uses getter/setter to allow reassignment.

let _controller: AbortController | null = null;
let _execId: string | null = null;
export const phIdToNodeId = new Map<string, string>();

export function getController() { return _controller; }
export function setController(c: AbortController | null) { _controller = c; }
export function getExecId() { return _execId; }
export function setExecId(id: string | null) { _execId = id; }
export function isAborted() { return _controller?.signal.aborted ?? false; }
export function getSignal() { return _controller?.signal; }
export function abortSession() { _controller?.abort(); _controller = null; _execId = null; }