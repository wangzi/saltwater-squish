import { listLatestProductMediaManifests } from '../server/product-media-manifests.js'

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

function isProductMediaKind(value: unknown): value is ProductMediaKind {
  return value === 'image' || value === 'video'
}

export default async function handler(_request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store')

  try {
    const metadataEntries = await listLatestProductMediaManifests<
      ProductMediaAsset,
      CatalogProduct
    >()
    const mediaByProduct: Record<string, ProductMediaAsset[]> = {}
    const products: CatalogProduct[] = []
    const revisionsByProduct: Record<string, string> = {}

    metadataEntries.forEach(({ manifest: metadata, revision }) => {
      const productId = metadata.productId
      revisionsByProduct[productId] = revision

      if (metadata.deletedAt || !Array.isArray(metadata.assets)) {
        return
      }

      mediaByProduct[productId] = metadata.assets.filter(
        (asset) =>
          asset.productId === productId &&
          isProductMediaKind(asset.kind) &&
          Boolean(asset.pathname) &&
          Boolean(asset.url),
      ).sort((left, right) => {
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

      if (metadata.product?.id === productId && metadata.product.sku) {
        products.push(metadata.product)
      }
    })

    products.sort((left, right) => left.sortOrder - right.sortOrder)

    return response.status(200).json({
      mediaByProduct,
      products,
      revisionsByProduct,
      source: 'blob',
    })
  } catch (error) {
    console.warn('Product media unavailable', error)
    return response.status(200).json({ mediaByProduct: {}, products: [], source: 'unavailable' })
  }
}
