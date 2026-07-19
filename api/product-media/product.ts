import {
  readLatestProductMediaManifest,
  writeProductMediaManifest,
} from '../../server/product-media-manifests.js'

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

type ProductMediaAsset = {
  [key: string]: unknown
  skuName?: string
}

type CatalogProduct = {
  [key: string]: unknown
  categories?: string[]
  id: string
  inventoryQuantity?: number
  name: string
  price?: number | null
}

type ProductMediaMetadata = {
  assets?: ProductMediaAsset[]
  deletedAt?: string
  product?: CatalogProduct
  productId?: string
  revision?: string
  updatedAt?: string
}

type ProductRequestBody = {
  categories?: unknown
  inventoryQuantity?: unknown
  name?: unknown
  price?: unknown
  productId?: unknown
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

function cleanProductId(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '')
    : ''
}

function cleanName(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 100) : ''
}

const allowedCategories = new Set([
  'Slow rise',
  'Sugar coated',
  'Coconut oil',
  'Vaseline',
  'Handpicked',
  'NorCal made',
])

function cleanCategories(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined
  }

  return [...new Set(value.filter((item): item is string => (
    typeof item === 'string' && allowedCategories.has(item)
  )))]
}

function cleanPrice(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value * 100) / 100
    : undefined
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

async function findMetadata(productId: string) {
  const loaded = await readLatestProductMediaManifest<ProductMediaAsset, CatalogProduct>(productId)

  if (!loaded || loaded.manifest.deletedAt) {
    return null
  }

  return { metadata: loaded.manifest as ProductMediaMetadata, revision: loaded.revision }
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'PATCH' && request.method !== 'DELETE') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  if (!isAuthorized(request)) {
    return response.status(401).json({ error: 'Unauthorized' })
  }

  const body = await readJsonBody<ProductRequestBody>(request).catch(
    (): ProductRequestBody => ({}),
  )
  const productId = cleanProductId(body.productId)

  if (!productId) {
    return response.status(400).json({ error: 'Choose a valid product.' })
  }

  const existing = await findMetadata(productId)

  if (!existing?.metadata.product || existing.metadata.product.id !== productId) {
    return response.status(404).json({ error: 'Product not found.' })
  }

  if (request.method === 'DELETE') {
    const deletedAt = new Date().toISOString()
    const saved = await writeProductMediaManifest<ProductMediaAsset, CatalogProduct>(
      productId,
      { assets: [], deletedAt },
    )

    return response.status(200).json({
      deletedAt,
      ok: true,
      retainedMedia: true,
      revision: saved.revision,
    })
  }

  const name = cleanName(body.name)
  const categories = cleanCategories(body.categories)
  const price = cleanPrice(body.price)
  const inventoryQuantity = cleanInventoryQuantity(body.inventoryQuantity)

  if (!name && !categories && price === undefined && inventoryQuantity === undefined) {
    return response.status(400).json({ error: 'Enter valid product changes.' })
  }

  const resolvedName = name || existing.metadata.product.name

  const metadata = {
    assets: name
      ? (existing.metadata.assets ?? []).map((asset) => ({ ...asset, skuName: resolvedName }))
      : existing.metadata.assets,
    product: {
      ...existing.metadata.product,
      ...(categories ? { categories } : {}),
      ...(inventoryQuantity !== undefined ? { inventoryQuantity } : {}),
      name: resolvedName,
      ...(price !== undefined ? { price } : {}),
    },
  }
  const saved = await writeProductMediaManifest<ProductMediaAsset, CatalogProduct>(
    productId,
    metadata,
  )

  return response.status(200).json({
    ok: true,
    product: metadata.product,
    revision: saved.revision,
  })
}
