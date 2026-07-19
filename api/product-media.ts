import { list } from '@vercel/blob'

type ApiRequest = {
  url?: string
}

type ApiResponse = {
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
  status: (code: number) => ApiResponse
}

type ProductMediaKind = 'image' | 'video'

type ProductImageVariant = {
  contentType: 'image/webp'
  height?: number
  size: number
  url: string
  width: number
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

type ProductMediaMetadata = {
  assets?: ProductMediaAsset[]
  product?: CatalogProduct
  productId?: string
}

function isProductMediaKind(value: unknown): value is ProductMediaKind {
  return value === 'image' || value === 'video'
}

async function readMetadata(url: string) {
  try {
    const response = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' })

    if (!response.ok) {
      return null
    }

    const metadata = (await response.json()) as ProductMediaMetadata

    if (!metadata.productId || !Array.isArray(metadata.assets)) {
      return null
    }

    const assets = metadata.assets.filter(
      (asset) =>
        asset.productId === metadata.productId &&
        isProductMediaKind(asset.kind) &&
        Boolean(asset.pathname) &&
        Boolean(asset.url),
    )

    return {
      assets,
      product: metadata.product,
      productId: metadata.productId,
    }
  } catch {
    return null
  }
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const bypassCache = typeof request.url === 'string' && request.url.includes('v=')
  response.setHeader(
    'Cache-Control',
    bypassCache ? 'private, no-store' : 'public, s-maxage=60, stale-while-revalidate=300',
  )

  try {
    const metadataResult = await list({ limit: 100, prefix: 'product-media-metadata/' })
    const metadataEntries = await Promise.all(
      metadataResult.blobs.map((blob) => readMetadata(blob.url)),
    )
    const mediaByProduct: Record<string, ProductMediaAsset[]> = {}
    const products: CatalogProduct[] = []

    metadataEntries.forEach((metadata) => {
      if (!metadata) {
        return
      }

      mediaByProduct[metadata.productId] = metadata.assets.sort((left, right) => {
        if (left.kind !== right.kind) {
          return left.kind === 'image' ? -1 : 1
        }

        const leftOrder = typeof left.sortOrder === 'number' ? left.sortOrder : Number.MAX_SAFE_INTEGER
        const rightOrder = typeof right.sortOrder === 'number' ? right.sortOrder : Number.MAX_SAFE_INTEGER

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder
        }

        const leftTime = left.uploadedAt ? new Date(left.uploadedAt).getTime() : 0
        const rightTime = right.uploadedAt ? new Date(right.uploadedAt).getTime() : 0
        return rightTime - leftTime
      })

      if (metadata.product?.id === metadata.productId && metadata.product.sku) {
        products.push(metadata.product)
      }
    })

    products.sort((left, right) => left.sortOrder - right.sortOrder)

    return response.status(200).json({ mediaByProduct, products, source: 'blob' })
  } catch (error) {
    console.warn('Product media unavailable', error)
    return response.status(200).json({ mediaByProduct: {}, products: [], source: 'unavailable' })
  }
}
