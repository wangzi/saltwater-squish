import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

declare const process: {
  env: {
    DROP_FILMS_ADMIN_PASSWORD?: string
  }
}

type ApiRequest = {
  body?: unknown
  headers: Record<string, string | string[] | undefined>
  method?: string
  url?: string
}

type ApiResponse = {
  json: (body: unknown) => void
  status: (code: number) => ApiResponse
}

const dropFilmAdminPassword = process.env.DROP_FILMS_ADMIN_PASSWORD ?? 'saltwater-sand-30'
const maxDropFilmBytes = 150 * 1024 * 1024
const allowedContentTypes = ['video/mp4', 'video/webm', 'video/quicktime']

type UploadPayload = {
  durationSeconds?: number
  title?: string
}

function headerValue(request: ApiRequest, name: string) {
  const value = request.headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function isAuthorized(request: ApiRequest) {
  return headerValue(request, 'x-drop-admin-password') === dropFilmAdminPassword
}

function cleanTitle(value: unknown) {
  if (typeof value !== 'string') {
    return 'Drop film'
  }

  return value.trim().replace(/\s+/g, ' ').slice(0, 80) || 'Drop film'
}

function parseUploadPayload(clientPayload: string | null): UploadPayload {
  if (!clientPayload) {
    return {}
  }

  try {
    return JSON.parse(clientPayload) as UploadPayload
  } catch {
    return {}
  }
}

async function readJsonBody<T>(request: ApiRequest): Promise<T> {
  if (typeof request.body === 'string') {
    return JSON.parse(request.body) as T
  }

  if (request.body && typeof request.body === 'object') {
    return request.body as T
  }

  return {} as T
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const body = await readJsonBody<HandleUploadBody>(request)

  try {
    const jsonResponse = await handleUpload({
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!isAuthorized(request)) {
          throw new Error('Unauthorized')
        }

        if (!pathname.startsWith('drop-films/')) {
          throw new Error('Drop films must upload inside the drop-films folder.')
        }

        const payload = parseUploadPayload(clientPayload)

        return {
          addRandomSuffix: true,
          allowedContentTypes,
          cacheControlMaxAge: 60 * 60 * 24 * 30,
          maximumSizeInBytes: maxDropFilmBytes,
          tokenPayload: JSON.stringify({
            durationSeconds: payload.durationSeconds,
            title: cleanTitle(payload.title),
          }),
        }
      },
      request: request as never,
    })

    return response.status(200).json(jsonResponse)
  } catch (error) {
    return response
      .status(400)
      .json({ error: error instanceof Error ? error.message : 'Upload failed.' })
  }
}
