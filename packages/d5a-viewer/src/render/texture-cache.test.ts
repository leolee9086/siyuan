import { describe, expect, it } from 'vitest'
import { assertDecodableD5TexturePayload, ProtectedD5TextureError } from './texture-cache'

describe('D5 texture payload classification', () => {
  it('marks official protected payloads as preserved instead of image decode failures', async () => {
    const blob = new Blob(['All those moments will be lost in time'])

    await expect(assertDecodableD5TexturePayload(blob, 'textures/um/protected.jpg'))
      .rejects.toBeInstanceOf(ProtectedD5TextureError)
  })

  it('allows ordinary image signatures through to the browser decoder', async () => {
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])])

    await expect(assertDecodableD5TexturePayload(blob, 'textures/albedo.jpg')).resolves.toBeUndefined()
  })
})
