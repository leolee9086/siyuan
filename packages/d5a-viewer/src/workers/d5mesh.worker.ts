/// <reference lib="webworker" />

import { parseD5Mesh } from '../core/d5mesh'
import type { ParseMeshRequest, ParseMeshResponse } from './protocol'

self.onmessage = (event: MessageEvent<ParseMeshRequest>) => {
  if (event.data.type !== 'parse') return
  const started = performance.now()
  try {
    const model = parseD5Mesh(event.data.buffer)
    const transfers = new Set<Transferable>()
    for (const descriptor of model.descriptors) transfers.add(asTransferable(descriptor.transform.buffer))
    for (const group of model.groups) {
      if (group.interleaved) {
        transfers.add(asTransferable(group.interleaved.buffer))
      } else {
        transfers.add(asTransferable(group.positions.buffer))
        transfers.add(asTransferable(group.normals.buffer))
        transfers.add(asTransferable(group.uvs.buffer))
        transfers.add(asTransferable(group.extra.buffer))
      }
      if (group.indices) transfers.add(asTransferable(group.indices.buffer))
    }
    const response: ParseMeshResponse = {
      type: 'result',
      model,
      elapsedMs: performance.now() - started,
    }
    self.postMessage(response, { transfer: [...transfers] })
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error))
    const response: ParseMeshResponse = {
      type: 'error',
      message: normalized.message,
      stack: normalized.stack,
    }
    self.postMessage(response)
  }
}

function asTransferable(buffer: ArrayBufferLike): ArrayBuffer {
  if (buffer instanceof ArrayBuffer) return buffer
  throw new Error('SharedArrayBuffer-backed mesh data is not transferable')
}
