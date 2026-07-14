import { list, put } from '@vercel/blob'
import sharp from 'sharp'

const imageWidths = [160, 256, 640, 768, 960]
const force = process.argv.includes('--force')

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  throw new Error('BLOB_READ_WRITE_TOKEN is required.')
}

function cleanVariantStem(pathname) {
  const fileName = pathname.split('/').pop() ?? 'product-image'

  return fileName
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(-72) || 'product-image'
}

async function createVariants(asset, productId) {
  const response = await fetch(asset.url)

  if (!response.ok) {
    throw new Error(`Unable to download ${asset.pathname} (${response.status}).`)
  }

  const source = Buffer.from(await response.arrayBuffer())
  const image = sharp(source, { failOn: 'none' }).rotate()
  const metadata = await image.metadata()
  const sourceWidth = metadata.width
  const sourceHeight = metadata.height

  if (!sourceWidth) {
    return []
  }

  const widths = imageWidths.filter((width) => width <= sourceWidth)
  const targetWidths = widths.length > 0 ? widths : [sourceWidth]
  const stem = cleanVariantStem(asset.pathname)

  return Promise.all(targetWidths.map(async (width) => {
    const output = await image
      .clone()
      .resize({ width, withoutEnlargement: true })
      .webp({ effort: 4, quality: width <= 160 ? 72 : 78 })
      .toBuffer()
    const blob = await put(`product-media-optimized/${productId}/${stem}-${width}.webp`, output, {
      access: 'public',
      allowOverwrite: true,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
      contentType: 'image/webp',
    })

    return {
      contentType: 'image/webp',
      height: sourceHeight ? Math.round((sourceHeight / sourceWidth) * width) : undefined,
      size: output.byteLength,
      url: blob.url,
      width,
    }
  }))
}

async function readMetadata(blob) {
  const response = await fetch(`${blob.url}?optimize=${Date.now()}`, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Unable to read ${blob.pathname} (${response.status}).`)
  }

  return response.json()
}

const result = await list({ limit: 100, prefix: 'product-media-metadata/' })
let optimizedImages = 0
let optimizedProducts = 0

for (const metadataBlob of result.blobs) {
  const metadata = await readMetadata(metadataBlob)
  const assets = Array.isArray(metadata.assets) ? metadata.assets : []
  let changed = false

  for (const asset of assets) {
    if (asset.kind !== 'image' || !asset.pathname || !asset.url) {
      continue
    }

    if (
      !force &&
      Array.isArray(asset.variants) &&
      imageWidths.every((width) => asset.variants.some((variant) => variant.width === width))
    ) {
      continue
    }

    process.stdout.write(`Optimizing ${metadata.productId}/${asset.title || asset.pathname}... `)
    asset.variants = await createVariants(asset, metadata.productId)
    optimizedImages += 1
    changed = true
    console.log(`${asset.variants.length} variants`)
  }

  if (!changed) {
    continue
  }

  metadata.updatedAt = new Date().toISOString()
  await put(metadataBlob.pathname, JSON.stringify(metadata), {
    access: 'public',
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: 'application/json',
  })
  optimizedProducts += 1
}

console.log(`Optimized ${optimizedImages} images across ${optimizedProducts} products.`)
