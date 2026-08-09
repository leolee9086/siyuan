import { describe, expect, it } from 'vitest'
import { loadGlbDocument, validateGlb } from './model-document'

function minimalGlb(version = 2): ArrayBuffer {
  const json = new TextEncoder().encode('{"asset":{"version":"2.0"}} ')
  const buffer = new ArrayBuffer(20 + json.byteLength)
  const view = new DataView(buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, version, true)
  view.setUint32(8, buffer.byteLength, true)
  view.setUint32(12, json.byteLength, true)
  view.setUint32(16, 0x4e4f534a, true)
  new Uint8Array(buffer, 20).set(json)
  return buffer
}

describe('GLB container validation', () => {
  it('accepts a structurally valid GLB 2 header and JSON chunk', () => {
    expect(() => validateGlb(minimalGlb())).not.toThrow()
  })

  it('rejects unsupported versions and inconsistent declared lengths', () => {
    expect(() => validateGlb(minimalGlb(1))).toThrow(/仅支持 GLB 2/)
    const buffer = minimalGlb()
    new DataView(buffer).setUint32(8, buffer.byteLength + 4, true)
    expect(() => validateGlb(buffer)).toThrow(/声明长度/)
  })

  it('revalidates and reloads a payload released after model parsing', async () => {
    const source = minimalGlb()
    const file = new File([source], 'fixture.glb', { type: 'model/gltf-binary' })
    const document = await loadGlbDocument(file)

    expect(document.glb.byteLength).toBe(source.byteLength)
    await document.close()
    expect(document.glb.byteLength).toBe(0)

    const reloaded = await document.takePayload()
    expect(reloaded.byteLength).toBe(source.byteLength)
    expect(document.glb.byteLength).toBe(0)

    const secondPayload = await document.takePayload()
    expect(secondPayload.byteLength).toBe(source.byteLength)
    expect(secondPayload).not.toBe(reloaded)
    expect(document.glb.byteLength).toBe(0)
  })
})
