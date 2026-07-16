import { list, put } from '@vercel/blob'

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
  kind: 'image' | 'video'
  pathname: string
  url: string
}

type ProductMediaMetadata = {
  assets?: ProductMediaAsset[]
  product?: { id: string }
  productId?: string
  updatedAt?: string
}

type ReconcileRequestBody = {
  dryRun?: unknown
  productId?: unknown
}

type MissingAsset = {
  kind: ProductMediaAsset['kind']
  pathname: string
  productId: string
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

function metadataPathFor(productId: string) {
  return `product-media-metadata/${productId}.json`
}

async function readJsonBody<T>(request: ApiRequest): Promise<T> {
  if (typeof request.body === 'string') {
    return JSON.parse(request.body) as T
  }

  return (request.body && typeof request.body === 'object' ? request.body : {}) as T
}

async function readMetadata(productId: string) {
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

  return {
    metadata: (await response.json()) as ProductMediaMetadata,
    pathname,
  }
}

async function assetExists(url: string) {
  if (!url) {
    return false
  }

  try {
    const response = await fetch(url, { cache: 'no-store', method: 'HEAD' })
    return response.ok
  } catch {
    return true
  }
}

async function findMissingAssets(assets: ProductMediaAsset[], productId: string) {
  const missing: MissingAsset[] = []

  for (const asset of assets) {
    if (!asset.pathname || !asset.url) {
      missing.push({
        kind: asset.kind,
        pathname: asset.pathname,
        productId,
      })
      continue
    }

    const exists = await assetExists(asset.url)

    if (!exists) {
      missing.push({
        kind: asset.kind,
        pathname: asset.pathname,
        productId,
      })
    }
  }

  return missing
}

async function reconcileProduct(productId: string, dryRun: boolean) {
  const existing = await readMetadata(productId)

  if (!existing?.metadata.product || existing.metadata.product.id !== productId) {
    return { missing: [] as MissingAsset[], removed: [] as MissingAsset[] }
  }

  const assets = existing.metadata.assets ?? []
  const missing = await findMissingAssets(assets, productId)

  if (missing.length === 0 || dryRun) {
    return { missing, removed: dryRun ? [] : missing }
  }

  const missingPathnames = new Set(missing.map((item) => item.pathname))
  const nextAssets = assets.filter((item) => !missingPathnames.has(item.pathname))
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

  return { missing, removed: missing }
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  if (!isAuthorized(request)) {
    return response.status(401).json({ error: 'Unauthorized' })
  }

  const body = await readJsonBody<ReconcileRequestBody>(request).catch(
    (): ReconcileRequestBody => ({}),
  )
  const productId = cleanProductId(body.productId)
  const dryRun = body.dryRun !== false

  try {
    if (productId) {
      const result = await reconcileProduct(productId, dryRun)

      return response.status(200).json({
        dryRun,
        missing: result.missing,
        ok: true,
        removed: result.removed,
      })
    }

    const metadataResult = await list({ limit: 100, prefix: 'product-media-metadata/' })
    const productIds = metadataResult.blobs
      .map((blob) => blob.pathname.replace('product-media-metadata/', '').replace(/\.json$/, ''))
      .filter(Boolean)
    const missing: MissingAsset[] = []
    const removed: MissingAsset[] = []

    for (const id of productIds) {
      const result = await reconcileProduct(id, dryRun)
      missing.push(...result.missing)

      if (!dryRun) {
        removed.push(...result.removed)
      }
    }

    return response.status(200).json({
      dryRun,
      missing,
      ok: true,
      removed: dryRun ? [] : removed,
    })
  } catch (error) {
    console.warn('Product media reconcile failed', error)
    return response.status(500).json({ error: 'Could not reconcile product media.' })
  }
}
