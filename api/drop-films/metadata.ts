import { put, type PutBlobResult } from '@vercel/blob'

declare const process: {
  env: {
    DROP_FILMS_ADMIN_PASSWORD?: string
  }
}

type ApiRequest = {
  body?: unknown
  headers: Record<string, string | string[] | undefined>
  method?: string
}

type ApiResponse = {
  json: (body: unknown) => void
  status: (code: number) => ApiResponse
}

type MetadataRequestBody = {
  blob?: Partial<PutBlobResult> & { size?: number }
  durationSeconds?: number
  title?: string
}

const dropFilmAdminPassword = process.env.DROP_FILMS_ADMIN_PASSWORD ?? 'saltwater-sand-30'

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

function metadataPathFor(pathname: string) {
  return `drop-film-metadata/${pathname.replace(/[^a-z0-9._-]+/gi, '_')}.json`
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

  if (!isAuthorized(request)) {
    return response.status(401).json({ error: 'Unauthorized' })
  }

  const body = await readJsonBody<MetadataRequestBody>(request).catch(
    (): MetadataRequestBody => ({}),
  )
  const pathname = body.blob?.pathname
  const url = body.blob?.url

  if (!pathname || !pathname.startsWith('drop-films/') || !url) {
    return response.status(400).json({ error: 'Missing uploaded film blob.' })
  }

  const durationSeconds =
    typeof body.durationSeconds === 'number' && Number.isFinite(body.durationSeconds)
      ? body.durationSeconds
      : undefined
  const metadata = {
    downloadUrl: body.blob?.downloadUrl,
    durationSeconds,
    pathname,
    size: body.blob?.size,
    title: cleanTitle(body.title),
    uploadedAt: new Date().toISOString(),
    url,
  }

  await put(metadataPathFor(pathname), JSON.stringify(metadata), {
    access: 'public',
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: 'application/json',
  })

  return response.status(200).json({ film: metadata, ok: true })
}
