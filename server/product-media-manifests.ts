import { randomUUID } from 'node:crypto'
import { list, put, type ListBlobResultBlob } from '@vercel/blob'

const legacyManifestPrefix = 'product-media-metadata/'
const revisionManifestPrefix = 'product-media-manifests/'
const immutableCacheSeconds = 31_536_000

export type ProductMediaManifest<TAsset = unknown, TProduct = unknown> = {
  assets?: TAsset[]
  deletedAt?: string
  product?: TProduct
  productId: string
  revision?: string
  updatedAt?: string
}

export type LoadedProductMediaManifest<TAsset = unknown, TProduct = unknown> = {
  blob: ListBlobResultBlob
  manifest: ProductMediaManifest<TAsset, TProduct>
  revision: string
}

function legacyManifestPath(productId: string) {
  return `${legacyManifestPrefix}${productId}.json`
}

function revisionManifestPath(productId: string, revision: string) {
  return `${revisionManifestPrefix}${productId}/${revision}.json`
}

export function productIdFromManifestPath(pathname: string) {
  if (pathname.startsWith(revisionManifestPrefix)) {
    const [productId, revisionFile, ...extra] = pathname
      .slice(revisionManifestPrefix.length)
      .split('/')

    if (productId && revisionFile?.endsWith('.json') && extra.length === 0) {
      return productId
    }

    return null
  }

  if (pathname.startsWith(legacyManifestPrefix)) {
    const fileName = pathname.slice(legacyManifestPrefix.length)

    if (fileName.endsWith('.json') && !fileName.includes('/')) {
      return fileName.slice(0, -'.json'.length) || null
    }
  }

  return null
}

function compareNewestFirst(left: ListBlobResultBlob, right: ListBlobResultBlob) {
  const timeDifference = right.uploadedAt.getTime() - left.uploadedAt.getTime()

  return timeDifference || right.pathname.localeCompare(left.pathname)
}

async function listAll(prefix: string) {
  const blobs: ListBlobResultBlob[] = []
  let cursor: string | undefined

  do {
    const result = await list({ cursor, limit: 1000, prefix })
    blobs.push(...result.blobs)
    cursor = result.hasMore ? result.cursor : undefined
  } while (cursor)

  return blobs
}

function revisionForBlob(
  blob: ListBlobResultBlob,
  manifest: ProductMediaManifest,
) {
  if (typeof manifest.revision === 'string' && manifest.revision.trim()) {
    return manifest.revision.trim()
  }

  return `${String(blob.uploadedAt.getTime()).padStart(13, '0')}-legacy`
}

async function readManifestBlob<TAsset, TProduct>(blob: ListBlobResultBlob) {
  try {
    const cacheKey = encodeURIComponent(blob.etag || String(blob.uploadedAt.getTime()))
    const separator = blob.url.includes('?') ? '&' : '?'
    const response = await fetch(`${blob.url}${separator}revision=${cacheKey}`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    const manifest = (await response.json()) as ProductMediaManifest<TAsset, TProduct>
    const productId = productIdFromManifestPath(blob.pathname)

    if (!productId || manifest.productId !== productId) {
      return null
    }

    return {
      blob,
      manifest,
      revision: revisionForBlob(blob, manifest),
    } satisfies LoadedProductMediaManifest<TAsset, TProduct>
  } catch {
    return null
  }
}

async function readNewestValidManifest<TAsset, TProduct>(
  candidates: ListBlobResultBlob[],
) {
  const newest = [...candidates].sort(compareNewestFirst)[0]

  if (!newest) {
    return null
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const loaded = await readManifestBlob<TAsset, TProduct>(newest)

    if (loaded) {
      return loaded
    }

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)))
    }
  }

  return null
}

export async function readLatestProductMediaManifest<TAsset, TProduct>(productId: string) {
  const [revisionBlobs, legacyBlobs] = await Promise.all([
    listAll(`${revisionManifestPrefix}${productId}/`),
    listAll(legacyManifestPath(productId)),
  ])
  const candidates = [
    ...revisionBlobs,
    ...legacyBlobs.filter((blob) => blob.pathname === legacyManifestPath(productId)),
  ]

  return readNewestValidManifest<TAsset, TProduct>(candidates)
}

export async function listLatestProductMediaManifests<TAsset, TProduct>() {
  const [revisionBlobs, legacyBlobs] = await Promise.all([
    listAll(revisionManifestPrefix),
    listAll(legacyManifestPrefix),
  ])
  const candidatesByProduct = new Map<string, ListBlobResultBlob[]>()

  for (const blob of [...revisionBlobs, ...legacyBlobs]) {
    const productId = productIdFromManifestPath(blob.pathname)

    if (!productId) {
      continue
    }

    const candidates = candidatesByProduct.get(productId) ?? []
    candidates.push(blob)
    candidatesByProduct.set(productId, candidates)
  }

  const loaded = await Promise.all(
    [...candidatesByProduct.values()].map((candidates) =>
      readNewestValidManifest<TAsset, TProduct>(candidates),
    ),
  )

  if (loaded.some((manifest) => !manifest)) {
    throw new Error('The newest product media manifest could not be read.')
  }

  return loaded as LoadedProductMediaManifest<TAsset, TProduct>[]
}

export async function writeProductMediaManifest<TAsset, TProduct>(
  productId: string,
  manifest: Omit<ProductMediaManifest<TAsset, TProduct>, 'productId' | 'revision' | 'updatedAt'>,
) {
  const timestamp = Date.now()
  const revision = `${String(timestamp).padStart(13, '0')}-${randomUUID()}`
  const nextManifest: ProductMediaManifest<TAsset, TProduct> = {
    ...manifest,
    productId,
    revision,
    updatedAt: new Date(timestamp).toISOString(),
  }
  const blob = await put(
    revisionManifestPath(productId, revision),
    JSON.stringify(nextManifest),
    {
      access: 'public',
      cacheControlMaxAge: immutableCacheSeconds,
      contentType: 'application/json',
    },
  )

  return { blob, manifest: nextManifest, revision }
}
