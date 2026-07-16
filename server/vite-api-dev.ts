import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ViteDevServer } from 'vite'

type ApiHandler = (
  request: {
    body?: unknown
    headers: Record<string, string | string[] | undefined>
    method?: string
    url?: string
  },
  response: {
    json: (body: unknown) => void
    status: (code: number) => { json: (body: unknown) => void }
  },
) => Promise<void> | void

function applyEnv(env: Record<string, string>) {
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function handlerPathFor(urlPathname: string) {
  const segments = urlPathname.slice('/api/'.length).split('/').filter(Boolean)

  if (segments.length === 0) {
    return null
  }

  const candidate = path.join(process.cwd(), 'api', ...segments) + '.ts'
  return fs.existsSync(candidate) ? candidate : null
}

async function readRequestBody(request: IncomingMessage) {
  const chunks: Buffer[] = []

  await new Promise<void>((resolve, reject) => {
    request.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    request.on('end', () => resolve())
    request.on('error', reject)
  })

  const rawBody = Buffer.concat(chunks).toString()

  if (!rawBody) {
    return undefined
  }

  const contentType = request.headers['content-type'] ?? ''

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(rawBody) as unknown
    } catch {
      return rawBody
    }
  }

  return rawBody
}

async function runApiHandler(
  server: ViteDevServer,
  request: IncomingMessage,
  response: ServerResponse,
  handlerPath: string,
) {
  const handlerModule = await server.ssrLoadModule(handlerPath) as { default?: ApiHandler }
  const handler = handlerModule.default

  if (!handler) {
    response.statusCode = 500
    response.end('API handler missing default export')
    return
  }

  const body = request.method === 'GET' || request.method === 'HEAD'
    ? undefined
    : await readRequestBody(request)

  let statusCode = 200
  let hasResponded = false

  const apiResponse = {
    status(code: number) {
      statusCode = code
      return apiResponse
    },
    json(payload: unknown) {
      if (hasResponded) {
        return
      }

      hasResponded = true
      response.statusCode = statusCode
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify(payload))
    },
  }

  await handler(
    {
      body,
      headers: request.headers as Record<string, string | string[] | undefined>,
      method: request.method,
      url: request.url,
    },
    apiResponse,
  )

  if (!hasResponded) {
    response.statusCode = 500
    response.end('API handler did not send a response')
  }
}

export function vercelApiDevPlugin(env: Record<string, string>): Plugin {
  applyEnv(env)

  return {
    name: 'vercel-api-dev',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const urlPathname = (request.url ?? '').split('?')[0]

        if (!urlPathname.startsWith('/api/')) {
          next()
          return
        }

        const handlerPath = handlerPathFor(urlPathname)

        if (!handlerPath) {
          response.statusCode = 404
          response.end('Not Found')
          return
        }

        try {
          await runApiHandler(server, request, response, handlerPath)
        } catch (error) {
          console.error(`[vercel-api-dev] ${urlPathname}`, error)
          if (!response.headersSent) {
            response.statusCode = 500
            response.setHeader('Content-Type', 'application/json')
            response.end(JSON.stringify({ error: 'Local API handler failed.' }))
          }
        }
      })
    },
  }
}
