import { del, list, put } from '@vercel/blob'

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

type ProductImageVariant = {
  url: string
}

type ProductMediaAsset = {
  id: string
  kind: 'image' | 'video'
  pathname: string
  url: string
  variants?: ProductImageVariant[]
}

type ProductMediaMetadata = {
  assets?: ProductMediaAsset[]
  product?: { id: string }
  productId?: string
  updatedAt?: string
}

type AssetRequestBody = {
  pathname?: unknown
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

function cleanPathname(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function metadataPathFor(productId: string) {
  return `product-media-metadata/${productId}.json`
}

async function readJsonBody<T>(request: ApiRequest): Promise<T> {
  if (typeof request.body === 'string') {
    return JSON.parse(request.body) as T
  }

  return (request.body && typeof request.body === 'object' ? request.body : {}) as T
}

async function findMetadata(productId: string) {
  const pathname = metadataPathFor(productId)
  const result = await list({ limit: 1, prefix: pathname })
  const blob = result.blobs.find((item) => item.pathname === pathname)

  if (!blob) {
    return null
  }

  const response = await fetch(`${blob.url}?v=${Date.now()}`, { cache: 'no-store' })

  if (!response.ok) {
    return null
  }

  return { metadata: (await response.json()) as ProductMediaMetadata, pathname }
}

function blobUrlsToDelete(asset: ProductMediaAsset) {
  const urls = [asset.url]

  if (asset.kind === 'image' && Array.isArray(asset.variants)) {
    for (const variant of asset.variants) {
      if (variant.url) {
        urls.push(variant.url)
      }
    }
  }

  return urls
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'DELETE') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  if (!isAuthorized(request)) {
    return response.status(401).json({ error: 'Unauthorized' })
  }

  const body = await readJsonBody<AssetRequestBody>(request).catch(
    (): AssetRequestBody => ({}),
  )
  const productId = cleanProductId(body.productId)
  const assetPathname = cleanPathname(body.pathname)

  if (!productId || !assetPathname) {
    return response.status(400).json({ error: 'Choose a valid product and media file.' })
  }

  const existing = await findMetadata(productId)

  if (!existing?.metadata.product || existing.metadata.product.id !== productId) {
    return response.status(404).json({ error: 'Product not found.' })
  }

  const assets = existing.metadata.assets ?? []
  const asset = assets.find((item) => item.pathname === assetPathname)

  if (!asset) {
    return response.status(404).json({ error: 'Media file not found.' })
  }

  const isProductUpload = assetPathname.startsWith(`product-media/${productId}/`)
  const isSharedDropFilm = assetPathname.startsWith('drop-films/')

  if (!isProductUpload && !isSharedDropFilm) {
    return response.status(400).json({ error: 'Invalid media file.' })
  }

  const nextAssets = assets.filter((item) => item.pathname !== assetPathname)
  const metadata: ProductMediaMetadata = {
    ...existing.metadata,
    assets: nextAssets,
    productId,
    updatedAt: new Date().toISOString(),
  }

  await put(existing.pathname, JSON.stringify(metadata), {
    access: 'public',
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: 'application/json',
  })

  if (isProductUpload) {
    await del(blobUrlsToDelete(asset)).catch((error) => {
      console.warn('Product media blob cleanup failed', error)
    })
  }

  return response.status(200).json({
    ok: true,
    removedPathname: assetPathname,
    retainedBlob: isSharedDropFilm,
  })
}
