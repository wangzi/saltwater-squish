import { list, put, type PutBlobResult } from '@vercel/blob'
import {
  createProductImageVariants,
  type ProductImageVariant,
} from '../../server/product-images.js'

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

type ProductMediaKind = 'image' | 'video'

type IncomingAsset = {
  blob?: Partial<PutBlobResult> & { size?: number }
  contentType?: string
  kind?: ProductMediaKind
  sortOrder?: number
  skuName?: string
  title?: string
}

type CatalogProduct = {
  aliases?: string[]
  categories?: string[]
  collection: string
  description: string
  feel: string
  id: string
  imagePosition: [number, number]
  inventoryQuantity?: number
  name: string
  price: number | null
  sku: string
  sortOrder: number
  status: 'draft' | 'published'
  subtitle: string
  tag: string
}

type MetadataRequestBody = IncomingAsset & {
  assets?: IncomingAsset[]
  product?: Partial<CatalogProduct>
  productId?: string
}

type ProductMediaAsset = {
  contentType?: string
  downloadUrl?: string
  id: string
  kind: ProductMediaKind
  pathname: string
  productId: string
  size?: number
  sortOrder?: number
  skuName?: string
  title?: string
  uploadedAt?: string
  url: string
  variants?: ProductImageVariant[]
}

type ProductMediaMetadata = {
  assets?: ProductMediaAsset[]
  product?: CatalogProduct
  productId?: string
  updatedAt?: string
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
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '')
}

function cleanTitle(value: unknown) {
  if (typeof value !== 'string') {
    return 'Product media'
  }

  return value.trim().replace(/\s+/g, ' ').slice(0, 100) || 'Product media'
}

function cleanSku(value: unknown) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().toUpperCase().replace(/[^A-Z0-9-]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40)
}

function cleanAliases(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => cleanTitle(item))
    .filter(Boolean)
    .slice(0, 30)
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
    return []
  }

  return [...new Set(value.filter((item): item is string => (
    typeof item === 'string' && allowedCategories.has(item)
  )))]
}

function cleanCatalogProduct(
  value: Partial<CatalogProduct> | undefined,
  productId: string,
  existing?: CatalogProduct,
) {
  if (!value && !existing) {
    return undefined
  }

  const source = { ...existing, ...value }
  const allowedFeels = new Set(['Clear Jelly', 'Slow Rise', 'Crunchy', 'Slushy', 'Cloud Soft', 'Icy'])
  const price = typeof source.price === 'number' && Number.isFinite(source.price) && source.price >= 0
    ? Math.round(source.price * 100) / 100
    : null
  const imagePosition: [number, number] =
    Array.isArray(source.imagePosition) && source.imagePosition.length === 2
      ? [Number(source.imagePosition[0]) || 0, Number(source.imagePosition[1]) || 0]
      : [0, 0]
  const inventoryQuantity = typeof source.inventoryQuantity === 'number' &&
    Number.isFinite(source.inventoryQuantity) && source.inventoryQuantity >= 0
    ? Math.floor(source.inventoryQuantity)
    : undefined

  return {
    aliases: cleanAliases(source.aliases),
    categories: cleanCategories(source.categories),
    collection: cleanTitle(source.collection ?? 'Shop'),
    description: cleanTitle(source.description ?? ''),
    feel: allowedFeels.has(source.feel ?? '') ? source.feel as string : 'Cloud Soft',
    id: productId,
    imagePosition,
    inventoryQuantity,
    name: cleanTitle(source.name ?? 'Untitled product'),
    price,
    sku: cleanSku(source.sku),
    sortOrder: typeof source.sortOrder === 'number' && Number.isFinite(source.sortOrder)
      ? Math.round(source.sortOrder)
      : 999,
    status: source.status === 'draft' ? 'draft' as const : 'published' as const,
    subtitle: cleanTitle(source.subtitle ?? ''),
    tag: cleanTitle(source.tag ?? ''),
  }
}

function metadataPathFor(productId: string) {
  return `product-media-metadata/${productId}.json`
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

async function readExistingMetadata(productId: string): Promise<ProductMediaMetadata> {
  const metadataPath = metadataPathFor(productId)
  const result = await list({ limit: 1, prefix: metadataPath })
  const blob = result.blobs.find((item) => item.pathname === metadataPath)

  if (!blob) {
    return { assets: [], productId }
  }

  try {
    const response = await fetch(`${blob.url}?v=${Date.now()}`, { cache: 'no-store' })

    if (!response.ok) {
      return { assets: [], productId }
    }

    const metadata = (await response.json()) as ProductMediaMetadata

    return {
      assets: Array.isArray(metadata.assets) ? metadata.assets : [],
      product: metadata.product,
      productId,
      updatedAt: metadata.updatedAt,
    }
  } catch {
    return { assets: [], productId }
  }
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
  const productId = cleanProductId(body.productId)

  if (!productId) {
    return response.status(400).json({ error: 'Missing product catalog data.' })
  }

  const existingMetadata = await readExistingMetadata(productId)
  const product = cleanCatalogProduct(body.product, productId, existingMetadata.product)
  const incomingAssets = Array.isArray(body.assets) ? body.assets : body.blob ? [body] : []

  if (incomingAssets.length === 0 && !product) {
    return response.status(400).json({ error: 'Missing product catalog data.' })
  }

  const now = new Date().toISOString()
  const uploadedAssets: ProductMediaAsset[] = []

  for (const [index, incomingAsset] of incomingAssets.entries()) {
    const pathname = incomingAsset.blob?.pathname
    const url = incomingAsset.blob?.url
    const isProductUpload = pathname?.startsWith(`product-media/${productId}/`)
    const isSharedDropFilm = pathname?.startsWith('drop-films/')

    if (!pathname || !url || (!isProductUpload && !isSharedDropFilm)) {
      return response.status(400).json({ error: 'Missing uploaded product media blob.' })
    }

    const kind: ProductMediaKind = incomingAsset.kind === 'video' ? 'video' : 'image'
    const title = cleanTitle(incomingAsset.title)
    const variants = kind === 'image' && isProductUpload
      ? await createProductImageVariants({ pathname, productId, sourceUrl: url }).catch((error) => {
          console.warn('Product image optimization failed', error)
          return []
        })
      : undefined

    uploadedAssets.push({
      contentType: incomingAsset.contentType,
      downloadUrl: incomingAsset.blob?.downloadUrl,
      id: pathname,
      kind,
      pathname,
      productId,
      size: incomingAsset.blob?.size,
      sortOrder:
        typeof incomingAsset.sortOrder === 'number' && Number.isFinite(incomingAsset.sortOrder)
          ? incomingAsset.sortOrder
          : index,
      skuName: cleanTitle(incomingAsset.skuName ?? product?.name ?? title),
      title,
      uploadedAt: now,
      url,
      variants,
    })
  }

  const uploadedPathnames = new Set(uploadedAssets.map((asset) => asset.pathname))
  const assets = [
    ...uploadedAssets,
    ...(existingMetadata.assets ?? []).filter((item) => !uploadedPathnames.has(item.pathname)),
  ]
  const metadata: ProductMediaMetadata = {
    assets,
    product,
    productId,
    updatedAt: now,
  }

  await put(metadataPathFor(productId), JSON.stringify(metadata), {
    access: 'public',
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: 'application/json',
  })

  return response.status(200).json({ media: uploadedAssets, ok: true, product })
}
