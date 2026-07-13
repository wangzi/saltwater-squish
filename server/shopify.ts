declare const process: {
  env: {
    SHOPIFY_API_VERSION?: string
    SHOPIFY_STOREFRONT_PRIVATE_TOKEN?: string
    SHOPIFY_STORE_DOMAIN?: string
  }
}

type HeaderValue = string | string[] | undefined

type ShopifyGraphqlResponse<T> = {
  data?: T
  errors?: Array<{ message?: string }>
}

const defaultShopifyApiVersion = '2026-07'

function cleanStoreDomain(value: string | undefined) {
  if (!value) {
    return ''
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
}

function cleanApiVersion(value: string | undefined) {
  return /^20\d{2}-(01|04|07|10)$/.test(value ?? '')
    ? value as string
    : defaultShopifyApiVersion
}

export function getShopifyConfiguration() {
  const storeDomain = cleanStoreDomain(process.env.SHOPIFY_STORE_DOMAIN)

  return {
    apiVersion: cleanApiVersion(process.env.SHOPIFY_API_VERSION),
    configured: Boolean(storeDomain),
    privateToken: process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN?.trim() ?? '',
    storeDomain,
  }
}

export function buyerIpFromHeaders(headers: Record<string, HeaderValue>) {
  const forwarded = headers['x-forwarded-for']
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded
  const firstAddress = value?.split(',')[0]?.trim()

  return firstAddress && firstAddress.length <= 64 ? firstAddress : undefined
}

export async function shopifyStorefrontRequest<T>({
  buyerIp,
  query,
  variables,
}: {
  buyerIp?: string
  query: string
  variables?: Record<string, unknown>
}) {
  const configuration = getShopifyConfiguration()

  if (!configuration.configured) {
    throw new Error('Shopify is not configured.')
  }

  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
  }

  if (configuration.privateToken) {
    headers['Shopify-Storefront-Private-Token'] = configuration.privateToken
  }

  if (buyerIp) {
    headers['Shopify-Storefront-Buyer-IP'] = buyerIp
  }

  const response = await fetch(
    `https://${configuration.storeDomain}/api/${configuration.apiVersion}/graphql.json`,
    {
      body: JSON.stringify({ query, variables }),
      headers,
      method: 'POST',
    },
  )
  const payload = (await response.json().catch(() => null)) as ShopifyGraphqlResponse<T> | null

  if (!response.ok) {
    throw new Error(`Shopify responded with HTTP ${response.status}.`)
  }

  if (!payload) {
    throw new Error('Shopify returned an unreadable response.')
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message || 'Shopify rejected the request.')
  }

  if (!payload.data) {
    throw new Error('Shopify returned no data.')
  }

  return payload.data
}
