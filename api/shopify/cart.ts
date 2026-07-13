import {
  buyerIpFromHeaders,
  getShopifyConfiguration,
  shopifyStorefrontRequest,
} from '../../server/shopify.js'

type ApiRequest = {
  body?: unknown
  headers: Record<string, string | string[] | undefined>
  method?: string
}

type ApiResponse = {
  json: (body: unknown) => void
  status: (code: number) => ApiResponse
}

type CartLineRequest = {
  merchandiseId?: unknown
  quantity?: unknown
}

type CartRequestBody = {
  lines?: CartLineRequest[]
}

type ShopifyCartData = {
  cartCreate: {
    cart?: {
      checkoutUrl: string
      cost: {
        subtotalAmount: {
          amount: string
          currencyCode: string
        }
        totalAmount: {
          amount: string
          currencyCode: string
        }
      }
      id: string
      totalQuantity: number
    } | null
    userErrors: Array<{ field?: string[] | null; message: string }>
    warnings: Array<{ message: string }>
  }
}

const cartCreateMutation = `#graphql
  mutation SaltwaterSquishCartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        totalQuantity
        cost {
          subtotalAmount {
            amount
            currencyCode
          }
          totalAmount {
            amount
            currencyCode
          }
        }
      }
      userErrors {
        field
        message
      }
      warnings {
        message
      }
    }
  }
`

async function readJsonBody<T>(request: ApiRequest): Promise<T> {
  if (typeof request.body === 'string') {
    return JSON.parse(request.body) as T
  }

  if (request.body && typeof request.body === 'object') {
    return request.body as T
  }

  return {} as T
}

function cleanLines(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.slice(0, 50).flatMap((line) => {
    const candidate = line as CartLineRequest
    const merchandiseId = typeof candidate.merchandiseId === 'string'
      ? candidate.merchandiseId.trim()
      : ''
    const quantity = typeof candidate.quantity === 'number'
      ? Math.max(1, Math.min(20, Math.round(candidate.quantity)))
      : 0

    if (!merchandiseId.startsWith('gid://shopify/ProductVariant/') || !quantity) {
      return []
    }

    return [{ merchandiseId, quantity }]
  })
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  if (!getShopifyConfiguration().configured) {
    return response.status(503).json({ configured: false, error: 'Shopify is not configured.' })
  }

  const body = await readJsonBody<CartRequestBody>(request).catch((): CartRequestBody => ({}))
  const lines = cleanLines(body.lines)

  if (lines.length === 0) {
    return response.status(400).json({ error: 'Add at least one available Shopify product.' })
  }

  try {
    const data = await shopifyStorefrontRequest<ShopifyCartData>({
      buyerIp: buyerIpFromHeaders(request.headers),
      query: cartCreateMutation,
      variables: {
        input: {
          attributes: [{ key: 'storefront', value: 'saltwatersquish.com' }],
          lines,
        },
      },
    })
    const payload = data.cartCreate

    if (payload.userErrors.length > 0 || !payload.cart) {
      return response.status(422).json({
        error: payload.userErrors[0]?.message ?? 'Shopify could not create the cart.',
        userErrors: payload.userErrors,
      })
    }

    return response.status(200).json({
      cart: payload.cart,
      checkoutUrl: payload.cart.checkoutUrl,
      configured: true,
      warnings: payload.warnings,
    })
  } catch (error) {
    console.warn('Shopify cart unavailable', error)
    return response.status(502).json({
      error: error instanceof Error ? error.message : 'Shopify checkout is unavailable.',
    })
  }
}
