import { put } from '@vercel/blob'
import sharp from 'sharp'

export type ProductImageVariant = {
  contentType: 'image/webp'
  height?: number
  size: number
  url: string
  width: number
}

const productImageWidths = [160, 256, 640, 768, 960]

function cleanVariantStem(pathname: string) {
  const fileName = pathname.split('/').pop() ?? 'product-image'

  return fileName
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(-72) || 'product-image'
}

export async function createProductImageVariants({
  pathname,
  productId,
  sourceUrl,
}: {
  pathname: string
  productId: string
  sourceUrl: string
}): Promise<ProductImageVariant[]> {
  const sourceResponse = await fetch(sourceUrl)

  if (!sourceResponse.ok) {
    throw new Error(`Unable to read uploaded image (${sourceResponse.status}).`)
  }

  const source = Buffer.from(await sourceResponse.arrayBuffer())
  const image = sharp(source, { failOn: 'none' }).rotate()
  const metadata = await image.metadata()
  const sourceWidth = metadata.width
  const sourceHeight = metadata.height

  if (!sourceWidth) {
    return []
  }

  const widths = productImageWidths.filter((width) => width <= sourceWidth)
  const targetWidths = widths.length > 0 ? widths : [sourceWidth]
  const variantStem = cleanVariantStem(pathname)

  return Promise.all(targetWidths.map(async (width) => {
    const output = await image
      .clone()
      .resize({ width, withoutEnlargement: true })
      .webp({ effort: 4, quality: width <= 160 ? 72 : 78 })
      .toBuffer()
    const variantPath = `product-media-optimized/${productId}/${variantStem}-${width}.webp`
    const blob = await put(variantPath, output, {
      access: 'public',
      allowOverwrite: true,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
      contentType: 'image/webp',
    })

    return {
      contentType: 'image/webp' as const,
      height: sourceHeight ? Math.round((sourceHeight / sourceWidth) * width) : undefined,
      size: output.byteLength,
      url: blob.url,
      width,
    }
  }))
}
