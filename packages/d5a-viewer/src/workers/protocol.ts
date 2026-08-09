import type { D5MeshModel } from '../core/types'

export interface ParseMeshRequest {
  type: 'parse'
  buffer: ArrayBuffer
}

export type ParseMeshResponse =
  | { type: 'result'; model: D5MeshModel; elapsedMs: number }
  | { type: 'error'; message: string; stack?: string }

\n