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
}

type ApiResponse = {
  json: (body: unknown) => void
  status: (code: number) => ApiResponse
}

type ProductMediaPayload = {
  kind?: string
  productId?: string
  skuName?: string
  title?: string
}

const adminPassword = process.env.DROP_FILMS_ADMIN_PASSWORD ?? 'saltwater-sand-30'
const maxProductMediaBytes = 150 * 1024 * 1024
const allowedContentTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]

function headerValue(request: ApiRequest, name: string) {
  const value = request.headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function isAuthorized(request: ApiRequest) {
  return headerValue(request, 'x-drop-admin-password') === adminPassword
}

function cleanText(value: unknown, fallback: string) {
  if (typeof value !== 'string') {
    return fallback
  }

  return value.trim().replace(/\s+/g, ' ').slice(0, 100) || fallback
}

function cleanProductId(value: unknown) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '')
}

function parseUploadPayload(clientPayload: string | null): ProductMediaPayload {
  if (!clientPayload) {
    return {}
  }

  try {
    return JSON.parse(clientPayload) as ProductMediaPayload
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

        if (!pathname.startsWith('product-media/')) {
          throw new Error('Product media must upload inside the product-media folder.')
        }

        const productIdFromPath = cleanProductId(pathname.split('/')[1])
        const payload = parseUploadPayload(clientPayload)
        const productId = cleanProductId(payload.productId)
        const kind = payload.kind === 'video' ? 'video' : 'image'

        if (!productId || productId !== productIdFromPath) {
          throw new Error('Product media upload path does not match the selected product.')
        }

        return {
          addRandomSuffix: true,
          allowedContentTypes,
          cacheControlMaxAge: 60 * 60 * 24 * 30,
          maximumSizeInBytes: maxProductMediaBytes,
          tokenPayload: JSON.stringify({
            kind,
            productId,
            skuName: cleanText(payload.skuName, 'Product'),
            title: cleanText(payload.title, 'Product media'),
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
