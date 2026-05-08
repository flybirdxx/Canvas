// Global type augmentations for the Canvas app

export {};

declare global {
  interface Window {
    __canvasBlobMigration?: Array<{ id: string; dataUrl: string }>;
    webkitAudioContext?: typeof AudioContext;
  }
}