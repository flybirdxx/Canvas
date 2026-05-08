// Centralized magic numbers and configuration constants 
  
/** Maximum number of history snapshots kept in undo stack. */  
export const MAX_HISTORY = 50; 
  
/** Coalesce window in ms: consecutive updates to the same field within this window merge into a single undo entry. */  
export const COALESCE_WINDOW_MS = 500; 
  
/** localStorage persist throttle delay in ms. */  
export const PERSIST_THROTTLE_MS = 300;  
  
/** Pending task resume interval in ms (3 min). */  
export const RESUME_INTERVAL_MS = 3 * 60 * 1000; 
  
/** Files larger than this use IndexedDB instead of localStorage. */  
export const BLOB_THRESHOLD_BYTES = 1 * 1024 * 1024;  
  
/** Default canvas dimensions per element type. */  
export const DEFAULT_ELEMENT_SIZE: Record<string, { w: number; h: number }> = { 
  sticky: { w: 220, h: 220 },  
  text: { w: 420, h: 280 },  
  image: { w: 560, h: 560 },  
  video: { w: 640, h: 360 },  
  audio: { w: 360, h: 96 },  
  script: { w: 480, h: 280 },  
  scene: { w: 320, h: 200 },  
}; 
  
/** NodeInputBar visibility threshold scale. */  
export const INPUT_BAR_VISIBLE_SCALE = 0.5;  
  
/** Gap between element bottom edge and NodeInputBar in canvas px. */  
export const INPUT_BAR_GAP_CANVAS = 6;  
  
/** File ingest: max video file size for thumbnail extraction. */  
export const VIDEO_THUMB_MAX_BYTES = 100 * 1024 * 1024;  
  
/** File ingest: max audio file size for waveform extraction. */  
export const AUDIO_WAVEFORM_MAX_BYTES = 50 * 1024 * 1024; 
