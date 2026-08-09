import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createSceneFileApi, CLI_SCENE_FILE_API_PATH } from './scene-file-server'
import { startStaticWebServer, type StaticWebServer } from './static-server'

const directories: string[] = []
const servers: StaticWebServer[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()))
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('pinned local scene file API', () => {
  it('exposes only the selected file through its tokenized loopback path', async () => {
    const directory = await temporaryDirectory()
    const filePath = join(directory, 'fixture.glb')
    await writeFile(filePath, new Uint8Array([1, 2, 3, 4]))
    await writeFile(join(directory, 'index.html'), '<main>scene</main>')
    const api = await createSceneFileApi(filePath, 'fixture-token')
    const server = await startStaticWebServer({
      root: directory,
      host: '127.0.0.1',
      port: 0,
      apiHandler: api.handler,
    })
    servers.push(server)

    const denied = await fetch(new URL(`${CLI_SCENE_FILE_API_PATH}?token=wrong`, server.url))
    expect(denied.status).toBe(404)
    const method = await fetch(new URL(`${CLI_SCENE_FILE_API_PATH}?token=fixture-token`, server.url), { method: 'POST' })
    expect(method.status).toBe(405)
    const response = await fetch(new URL(`${CLI_SCENE_FILE_API_PATH}?token=fixture-token`, server.url))
    expect(response.headers.get('x-d5-scene-filename')).toBe('fixture.glb')
    expect(response.headers.get('content-type')).toContain('model/gltf-binary')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]))
    const head = await fetch(new URL(`${CLI_SCENE_FILE_API_PATH}?token=fixture-token`, server.url), { method: 'HEAD' })
    expect(head.status).toBe(200)
    expect(head.headers.get('content-length')).toBe('4')
    expect(await head.text()).toBe('')
  })
})

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'd5-scene-file-'))
  directories.push(directory)
  return directory
}
