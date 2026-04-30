import type Konva from 'konva';

/**
 * Module-level singleton that lets non-React code (e.g. download utilities)
 * reach the current Konva Stage without threading refs through props.
 *
 * InfiniteCanvas calls setStage() on mount and setStage(null) on unmount.
 */
let _stage: Konva.Stage | null = null;

export function setStage(stage: Konva.Stage | null): void {
  _stage = stage;
}

export function getStage(): Konva.Stage | null {
  return _stage;
}
