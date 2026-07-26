import { listProducts } from '../server/products.js'

declare const process: {
  env: {
    DROP_FILMS_ADMIN_PASSWORD?: string
  }
}

type ApiRequest = {
  headers: Record<string, string | string[] | undefined>
  method?: string
}

type ApiResponse = {
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
  status: (code: number) => ApiResponse
}

const adminPassword = process.env.DROP_FILMS_ADMIN_PASSWORD?.trim()

function headerValue(request: ApiRequest, name: string) {
  const value = request.headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function isAuthorized(request: ApiRequest) {
  return Boolean(adminPassword)
    && headerValue(request, 'x-drop-admin-password') === adminPassword
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { products, source } = await listProducts({
      includeDrafts: isAuthorized(request),
    })

    response.setHeader('cache-control', 'no-store')
    return response.status(200).json({ products, source })
  } catch (error) {
    console.warn('Products unavailable', error)
    return response.status(502).json({
      error: error instanceof Error ? error.message : 'Products unavailable.',
      products: [],
      source: 'unavailable',
    })
  }
}
