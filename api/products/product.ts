import {
  createProduct,
  deleteProduct,
  updateProduct,
  type ProductRecord,
} from '../../server/products.js'

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

type ProductRequestBody = {
  categories?: unknown
  collection?: unknown
  description?: unknown
  feel?: unknown
  id?: unknown
  imagePosition?: unknown
  inventoryQuantity?: unknown
  name?: unknown
  price?: unknown
  productId?: unknown
  sku?: unknown
  sortOrder?: unknown
  status?: unknown
  subtitle?: unknown
  tag?: unknown
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

async function readJsonBody<T>(request: ApiRequest): Promise<T> {
  if (typeof request.body === 'string') {
    return JSON.parse(request.body) as T
  }

  return (request.body && typeof request.body === 'object' ? request.body : {}) as T
}

function cleanProductId(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '')
    : ''
}

function cleanTitle(value: unknown, maxLength = 120) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : ''
}

function cleanSku(value: unknown) {
  return typeof value === 'string' ? value.trim().toUpperCase().slice(0, 40) : ''
}

function cleanFeel(value: unknown) {
  const allowed = new Set([
    'Clear Jelly',
    'Slow Rise',
    'Crunchy',
    'Slushy',
    'Cloud Soft',
    'Icy',
  ])

  return typeof value === 'string' && allowed.has(value) ? value : 'Cloud Soft'
}

function cleanStatus(value: unknown) {
  return value === 'draft' ? 'draft' as const : 'published' as const
}

function cleanImagePosition(value: unknown): [number, number] {
  return Array.isArray(value) && value.length === 2
    ? [Number(value[0]) || 0, Number(value[1]) || 0]
    : [0, 0]
}

function cleanCreateProductBody(body: ProductRequestBody): ProductRecord | null {
  const id = cleanProductId(body.id ?? body.productId)
  const name = cleanTitle(body.name, 100)
  const sku = cleanSku(body.sku)

  if (!id || !name || !sku) {
    return null
  }

  return {
    aliases: [],
    categories: [],
    collection: cleanTitle(body.collection) || 'Shop',
    description: cleanTitle(body.description),
    feel: cleanFeel(body.feel),
    id,
    imagePosition: cleanImagePosition(body.imagePosition),
    name,
    price: null,
    sku,
    sortOrder: typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)
      ? Math.round(body.sortOrder)
      : 999,
    status: cleanStatus(body.status),
    subtitle: cleanTitle(body.subtitle),
    tag: cleanTitle(body.tag) || 'Shop',
  }
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!isAuthorized(request)) {
    return response.status(401).json({ error: 'Unauthorized' })
  }

  const body = await readJsonBody<ProductRequestBody>(request).catch(
    (): ProductRequestBody => ({}),
  )
  const productId = cleanProductId(body.productId ?? body.id)

  try {
    if (request.method === 'POST') {
      const product = cleanCreateProductBody(body)

      if (!product) {
        return response.status(400).json({ error: 'Enter a valid product id, name, and SKU.' })
      }

      const created = await createProduct(product)
      return response.status(201).json({ ok: true, product: created })
    }

    if (!productId) {
      return response.status(400).json({ error: 'Choose a valid product.' })
    }

    if (request.method === 'DELETE') {
      const deleted = await deleteProduct(productId)
      return response.status(200).json({ ok: true, ...deleted })
    }

    if (request.method !== 'PATCH') {
      return response.status(405).json({ error: 'Method not allowed' })
    }

    const price = body.price === null
      ? null
      : typeof body.price === 'number' && Number.isFinite(body.price) && body.price >= 0
        ? Math.round(body.price * 100) / 100
        : undefined
    const inventoryQuantity = typeof body.inventoryQuantity === 'number'
      && Number.isFinite(body.inventoryQuantity)
      && body.inventoryQuantity >= 0
      ? Math.floor(body.inventoryQuantity)
      : undefined
    const name = body.name === undefined ? undefined : cleanTitle(body.name, 100)
    const categories = body.categories === undefined
      ? undefined
      : [...new Set(Array.isArray(body.categories)
        ? body.categories.filter((item): item is string => typeof item === 'string')
        : [])]

    if (
      name === undefined
      && categories === undefined
      && price === undefined
      && inventoryQuantity === undefined
    ) {
      return response.status(400).json({ error: 'Enter valid product changes.' })
    }

    const product = await updateProduct(productId, {
      categories,
      inventoryQuantity,
      name,
      price,
    })

    return response.status(200).json({ ok: true, product })
  } catch (error) {
    console.warn('Product update failed', error)
    const message = error instanceof Error ? error.message : 'Product update failed.'
    const status = message === 'Product not found.' ? 404 : 502
    return response.status(status).json({ error: message })
  }
}
