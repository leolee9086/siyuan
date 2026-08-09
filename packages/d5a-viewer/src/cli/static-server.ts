import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { extname, resolve, sep } from 'node:path'

export interface StaticWebServerOptions {
  root: string
  host: string
  port: number
  portAttempts?: number
  apiHandler?: (request: IncomingMessage, response: ServerResponse) => boolean | Promise<boolean>
}

export interface StaticWebServer {
  server: Server
  host: string
  port: number
  url: string
  close(): Promise<void>
}

export async function startStaticWebServer(options: StaticWebServerOptions): Promise<StaticWebServer> {
  const root = resolve(options.root)
  const attempts = Math.max(1, options.portAttempts ?? 20)
  await stat(resolve(root, 'index.html'))
  let lastError: unknown
  for (let offset = 0; offset < attempts; offset += 1) {
    const port = options.port === 0 ? 0 : options.port + offset
    if (port > 65_535) break
    const server = createServer((request, response) => {
      void handleRequest(options.apiHandler, root, request, response)
    })
    try {
      await listen(server, options.host, port)
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('本地 WebUI 服务没有 TCP 地址')
      const displayHost = options.host.includes(':') ? `[${options.host}]` : options.host
      return {
        server,
        host: options.host,
        port: address.port,
        url: `http://${displayHost}:${address.port}/`,
        close: () => closeServer(server),
      }
    } catch (error) {
      lastError = error
      await closeServer(server).catch(() => undefined)
      if (!hasErrorCode(error, 'EADDRINUSE') || options.port === 0) throw error
    }
  }
  throw lastError ?? new Error('没有可用的本地 WebUI 端口')
}

async function handleRequest(
  apiHandler: StaticWebServerOptions['apiHandler'],
  root: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    if (apiHandler && await apiHandler(request, response)) return
    await serveStaticRequest(root, request.url ?? '/', request.method ?? 'GET', request.headers['if-none-match'], response)
  } catch (error) {
    if (!response.headersSent) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Internal Server Error')
    } else {
      response.destroy(error instanceof Error ? error : undefined)
    }
  }
}

async function serveStaticRequest(
  root: string,
  rawUrl: string,
  method: string,
  ifNoneMatch: string | undefined,
  response: ServerResponse,
): Promise<void> {
  try {
    if (method !== 'GET' && method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Method Not Allowed')
      return
    }
    const url = new URL(rawUrl, 'http://localhost')
    const pathname = decodeURIComponent(url.pathname).replace(/\\/g, '/')
    const requested = pathname === '/' ? '/index.html' : pathname
    const candidate = resolve(root, `.${requested}`)
    if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
      response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Forbidden')
      return
    }
    let filePath = candidate
    let metadata = await fileStat(filePath)
    if ((!metadata || !metadata.isFile()) && !extname(requested)) {
      filePath = resolve(root, 'index.html')
      metadata = await fileStat(filePath)
    }
    if (!metadata?.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Not Found')
      return
    }
    const etag = `W/\"${metadata.size.toString(16)}-${Math.trunc(metadata.mtimeMs).toString(16)}\"`
    const headers = {
      'Content-Type': mimeType(filePath),
      'Content-Length': metadata.size,
      'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
      ETag: etag,
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
    }
    if (ifNoneMatch === etag) {
      response.writeHead(304, headers)
      response.end()
      return
    }
    response.writeHead(200, headers)
    if (method === 'HEAD') {
      response.end()
      return
    }
    createReadStream(filePath)
      .on('error', (error) => response.destroy(error))
      .pipe(response)
  } catch (error) {
    if (!response.headersSent) {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Bad Request')
    } else {
      response.destroy(error instanceof Error ? error : undefined)
    }
  }
}

async function fileStat(path: string) {
  try {
    return await stat(path)
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) return undefined
    throw error
  }
}

function listen(server: Server, host: string, port: number): Promise<void> {
  return new Promise((resolveListen, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening)
      reject(error)
    }
    const onListening = () => {
      server.off('error', onError)
      resolveListen()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, host)
  })
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolveClose, reject) => {
    if (!server.listening) {
      resolveClose()
      return
    }
    server.close((error) => error ? reject(error) : resolveClose())
  })
}

function mimeType(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.html': return 'text/html; charset=utf-8'
    case '.js': case '.mjs': return 'text/javascript; charset=utf-8'
    case '.css': return 'text/css; charset=utf-8'
    case '.json': case '.map': return 'application/json; charset=utf-8'
    case '.png': return 'image/png'
    case '.jpg': case '.jpeg': return 'image/jpeg'
    case '.webp': return 'image/webp'
    case '.svg': return 'image/svg+xml'
    case '.woff2': return 'font/woff2'
    default: return 'application/octet-stream'
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === code)
}
