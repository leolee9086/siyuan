import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { startStaticWebServer, type StaticWebServer } from './static-server'

const directories: string[] = []
const servers: StaticWebServer[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()))
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('local static WebUI server', () => {
  it('serves assets, HEAD, cache validation and SPA routes from one root', async () => {
    const root = await temporaryDirectory()
    await mkdir(join(root, 'assets'))
    await writeFile(join(root, 'index.html'), '<main>D5 WebUI</main>')
    await writeFile(join(root, 'assets', 'app.js'), 'export const ready = true')
    const server = await startStaticWebServer({ root, host: '127.0.0.1', port: 0 })
    servers.push(server)

    const index = await fetch(server.url)
    expect(await index.text()).toContain('D5 WebUI')
    expect(index.headers.get('cache-control')).toBe('no-cache')
    const asset = await fetch(new URL('assets/app.js', server.url))
    expect(await asset.text()).toContain('ready = true')
    const head = await fetch(new URL('assets/app.js', server.url), { method: 'HEAD' })
    expect(await head.text()).toBe('')
    expect(head.headers.get('content-length')).toBe('25')
    const cached = await fetch(new URL('assets/app.js', server.url), {
      headers: { 'If-None-Match': asset.headers.get('etag')! },
    })
    expect(cached.status).toBe(304)
    expect(await (await fetch(new URL('materials/new', server.url))).text()).toContain('D5 WebUI')
  })

  it('does not expose files outside the configured root', async () => {
    const root = await temporaryDirectory()
    await writeFile(join(root, 'index.html'), 'index')
    const server = await startStaticWebServer({ root, host: '127.0.0.1', port: 0 })
    servers.push(server)

    const response = await fetch(`${server.url}%2e%2e/%2e%2e/secret.txt`)
    expect([403, 404]).toContain(response.status)
  })
})

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'd5-webui-'))
  directories.push(directory)
  return directory
}
