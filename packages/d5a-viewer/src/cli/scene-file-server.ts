import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { basename, extname, resolve } from 'node:path'

export const CLI_SCENE_FILE_API_PATH = '/api/scene-file'

export interface SceneFileApi {
  input: string
  filename: string
  bytes: number
  lastModified: number
  handler(request: IncomingMessage, response: ServerResponse): Promise<boolean>
}

export async function createSceneFileApi(input: string, token: string): Promise<SceneFileApi> {
  if (!token) throw new Error('场景查看令牌不能为空')
  const resolvedInput = resolve(input)
  const initial = await assertFile(resolvedInput)
  const filename = basename(resolvedInput)
  return {
    input: resolvedInput,
    filename,
    bytes: initial.size,
    lastModified: initial.mtimeMs,
    async handler(request, response) {
      const url = new URL(request.url ?? '/', 'http://localhost')
      if (url.pathname !== CLI_SCENE_FILE_API_PATH) return false
      if (url.searchParams.get('token') !== token) {
        response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
        response.end(JSON.stringify({ schemaVersion: 1, error: 'scene-not-found' }))
        return true
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'application/json; charset=utf-8' })
        response.end(JSON.stringify({ schemaVersion: 1, error: 'method-not-allowed' }))
        return true
      }
      const metadata = await assertFile(resolvedInput)
      response.writeHead(200, {
        'Content-Type': mimeType(resolvedInput),
        'Content-Length': metadata.size,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-D5-Scene-Filename': encodeURIComponent(filename),
        'X-D5-Scene-Last-Modified': `${Math.trunc(metadata.mtimeMs)}`,
      })
      if (request.method === 'HEAD') {
        response.end()
        return true
      }
      createReadStream(resolvedInput)
        .on('error', (error) => response.destroy(error))
        .pipe(response)
      return true
    },
  }
}

async function assertFile(path: string) {
  const metadata = await stat(path)
  if (!metadata.isFile()) throw new Error(`${path} 不是文件`)
  return metadata
}

function mimeType(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.d5a': return 'application/zip'
    case '.glb': return 'model/gltf-binary'
    default: return 'application/octet-stream'
  }
}
