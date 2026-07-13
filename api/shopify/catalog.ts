import {
  buyerIpFromHeaders,
  getShopifyConfiguration,
  shopifyStorefrontRequest,
} from '../../server/shopify.js'

type ApiRequest = {
  headers: Record<string, string | string[] | undefined>
  method?: string
}

type ApiResponse = {
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
  status: (code: number) => ApiResponse
}

type ShopifyCatalogData = {
  products: {
    nodes: Array<{
      handle: string
      id: string
      title: string
      variants: {
        nodes: Array<{
          availableForSale: boolean
          id: string
          price: {
            amount: string
            currencyCode: string
          }
          sku?: string | null
          title: string
        }>
      }
    }>
  }
}

const catalogQuery = `#graphql
  query SaltwaterSquishCatalog {
    products(first: 100) {
      nodes {
        id
        handle
        title
        variants(first: 100) {
          nodes {
            id
            sku
            title
            availableForSale
            price {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
`

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const configuration = getShopifyConfiguration()

  if (!configuration.configured) {
    return response.status(200).json({ configured: false, productsBySku: {} })
  }

  try {
    const data = await shopifyStorefrontRequest<ShopifyCatalogData>({
      buyerIp: buyerIpFromHeaders(request.headers),
      query: catalogQuery,
    })
    const productsBySku: Record<string, unknown> = {}
    const duplicateSkus: string[] = []

    data.products.nodes.forEach((product) => {
      product.variants.nodes.forEach((variant) => {
        const sku = variant.sku?.trim().toUpperCase()

        if (!sku) {
          return
        }

        if (productsBySku[sku]) {
          duplicateSkus.push(sku)
          return
        }

        productsBySku[sku] = {
          availableForSale: variant.availableForSale,
          currencyCode: variant.price.currencyCode,
          handle: product.handle,
          price: variant.price.amount,
          productId: product.id,
          productTitle: product.title,
          variantId: variant.id,
          variantTitle: variant.title,
        }
      })
    })

    response.setHeader('cache-control', 's-maxage=30, stale-while-revalidate=60')
    return response.status(200).json({
      configured: true,
      duplicateSkus,
      productsBySku,
      storeDomain: configuration.storeDomain,
    })
  } catch (error) {
    console.warn('Shopify catalog unavailable', error)
    return response.status(502).json({
      configured: true,
      error: error instanceof Error ? error.message : 'Shopify catalog unavailable.',
      productsBySku: {},
    })
  }
}
