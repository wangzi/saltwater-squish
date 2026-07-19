import { randomUUID } from 'node:crypto'
import { list, put } from '@vercel/blob'

const legacyManifestPrefix = 'product-media-metadata/'
const revisionManifestPrefix = 'product-media-manifests/'

function productIdFromPath(pathname) {
  if (pathname.startsWith(revisionManifestPrefix)) {
    const [productId, revisionFile, ...extra] = pathname
      .slice(revisionManifestPrefix.length)
      .split('/')

    return productId && revisionFile?.endsWith('.json') && extra.length === 0
      ? productId
      : null
  }

  if (pathname.startsWith(legacyManifestPrefix)) {
    const fileName = pathname.slice(legacyManifestPrefix.length)
    return fileName.endsWith('.json') && !fileName.includes('/')
      ? fileName.slice(0, -'.json'.length) || null
      : null
  }

  return null
}

async function listAll(prefix) {
  const blobs = []
  let cursor

  do {
    const result = await list({ cursor, limit: 1000, prefix })
    blobs.push(...result.blobs)
    cursor = result.hasMore ? result.cursor : undefined
  } while (cursor)

  return blobs
}

async function readCandidate(blob) {
  const separator = blob.url.includes('?') ? '&' : '?'
  const cacheKey = encodeURIComponent(blob.etag || String(blob.uploadedAt.getTime()))
  const response = await fetch(`${blob.url}${separator}revision=${cacheKey}`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    return null
  }

  const manifest = await response.json()
  const productId = productIdFromPath(blob.pathname)
  return productId && manifest.productId === productId ? { blob, manifest } : null
}

async function readNewest(candidates) {
  const newest = [...candidates].sort((left, right) => (
    right.uploadedAt.getTime() - left.uploadedAt.getTime() ||
    right.pathname.localeCompare(left.pathname)
  ))[0]

  if (!newest) return null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const loaded = await readCandidate(newest)
    if (loaded) return loaded

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)))
    }
  }

  return null
}

export async function readLatestProductManifest(productId) {
  const legacyPath = `${legacyManifestPrefix}${productId}.json`
  const [revisions, legacy] = await Promise.all([
    listAll(`${revisionManifestPrefix}${productId}/`),
    listAll(legacyPath),
  ])

  return readNewest([
    ...revisions,
    ...legacy.filter((blob) => blob.pathname === legacyPath),
  ])
}

export async function listLatestProductManifests() {
  const [revisions, legacy] = await Promise.all([
    listAll(revisionManifestPrefix),
    listAll(legacyManifestPrefix),
  ])
  const candidatesByProduct = new Map()

  for (const blob of [...revisions, ...legacy]) {
    const productId = productIdFromPath(blob.pathname)
    if (!productId) continue
    candidatesByProduct.set(productId, [...(candidatesByProduct.get(productId) ?? []), blob])
  }

  const loaded = await Promise.all(
    [...candidatesByProduct.values()].map((candidates) => readNewest(candidates)),
  )

  if (loaded.some((manifest) => !manifest)) {
    throw new Error('The newest product media manifest could not be read.')
  }

  return loaded
}

export async function writeProductManifest(productId, value) {
  const timestamp = Date.now()
  const revision = `${String(timestamp).padStart(13, '0')}-${randomUUID()}`
  const manifest = {
    ...value,
    productId,
    revision,
    updatedAt: new Date(timestamp).toISOString(),
  }
  const blob = await put(
    `${revisionManifestPrefix}${productId}/${revision}.json`,
    JSON.stringify(manifest),
    {
      access: 'public',
      cacheControlMaxAge: 60 * 60 * 24 * 365,
      contentType: 'application/json',
    },
  )

  return { blob, manifest, revision }
}
