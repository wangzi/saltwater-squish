import {
  getShopifyAdminConfiguration,
  setVariantInventoryQuantity,
} from '../../server/shopify.js'

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

type InventoryRequestBody = {
  inventoryQuantity?: unknown
  variantId?: unknown
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

function cleanVariantId(value: unknown) {
  return typeof value === 'string' && value.trim().startsWith('gid://shopify/ProductVariant/')
    ? value.trim()
    : ''
}

function cleanInventoryQuantity(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : undefined
}

async function readJsonBody<T>(request: ApiRequest): Promise<T> {
  if (typeof request.body === 'string') {
    return JSON.parse(request.body) as T
  }

  return (request.body && typeof request.body === 'object' ? request.body : {}) as T
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'PATCH') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  if (!isAuthorized(request)) {
    return response.status(401).json({ error: 'Unauthorized' })
  }

  const configuration = getShopifyAdminConfiguration()

  if (!configuration.adminConfigured) {
    return response.status(503).json({
      error: 'Shopify admin inventory updates are not configured.',
    })
  }

  const body = await readJsonBody<InventoryRequestBody>(request).catch(
    (): InventoryRequestBody => ({}),
  )
  const variantId = cleanVariantId(body.variantId)
  const inventoryQuantity = cleanInventoryQuantity(body.inventoryQuantity)

  if (!variantId || inventoryQuantity === undefined) {
    return response.status(400).json({ error: 'Enter a valid variant and quantity.' })
  }

  try {
    const quantity = await setVariantInventoryQuantity(variantId, inventoryQuantity)

    return response.status(200).json({
      inventoryQuantity: quantity,
      ok: true,
      variantId,
    })
  } catch (error) {
    console.warn('Shopify inventory update failed', error)
    return response.status(502).json({
      error: error instanceof Error ? error.message : 'Shopify inventory update failed.',
    })
  }
}
