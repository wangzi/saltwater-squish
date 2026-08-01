import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { list, put } from '@vercel/blob'
import {
  listLatestProductMediaManifests,
  writeProductMediaManifest,
} from '../../server/product-media-manifests.js'
import { getShopifyConfiguration } from '../../server/shopify.js'

declare const process: {
  env: {
    SHOPIFY_APP_CLIENT_SECRET?: string
    SHOPIFY_CLIENT_ID?: string
    SHOPIFY_CLIENT_SECRET?: string
    SHOPIFY_WEBHOOK_SECRET?: string
  }
}

type ProductMediaAsset = Record<string, unknown>

type CatalogProduct = Record<string, unknown> & {
  id: string
  inventoryQuantity?: number
  sku: string
}

type ShopifyInventoryLevel = {
  inventory_item_id?: number | string
}

type ShopifyInventoryItemResponse = {
  data?: {
    inventoryItem?: {
      inventoryLevels: {
        nodes: Array<{
          quantities: Array<{
            name: string
            quantity: number
          }>
        }>
        pageInfo: {
          hasNextPage: boolean
        }
      }
      sku?: string | null
    } | null
  }
  errors?: Array<{ message?: string }>
}

type ShopifyAccessTokenResponse = {
  access_token?: string
  expires_in?: number
}

const inventoryItemQuery = `
  query InventoryItemForWebhook($id: ID!) {
    inventoryItem(id: $id) {
      sku
      inventoryLevels(first: 250) {
        nodes {
          quantities(names: ["available"]) {
            name
            quantity
          }
        }
        pageInfo {
          hasNextPage
        }
      }
    }
  }
`

let cachedAccessToken: { expiresAt: number; value: string } | null = null
let pendingAccessToken: Promise<string> | null = null

function hasValidSignature(rawBody: Buffer, signature: string, secret: string) {
  const received = Buffer.from(signature, 'base64')
  const expected = createHmac('sha256', secret).update(rawBody).digest()

  return received.length === expected.length && timingSafeEqual(received, expected)
}

function receiptPath(shopDomain: string, webhookId: string, rawBody: Buffer) {
  const eventId = webhookId || createHash('sha256').update(rawBody).digest('hex')
  const key = createHash('sha256').update(`${shopDomain}:${eventId}`).digest('hex')
  return `shopify-webhook-receipts/inventory-levels-update/${key}.json`
}

async function receiptExists(pathname: string) {
  const result = await list({ limit: 1, prefix: pathname })
  return result.blobs.some((blob) => blob.pathname === pathname)
}

async function requestShopifyAdminAccessToken() {
  const configuration = getShopifyConfiguration()
  const clientId = process.env.SHOPIFY_CLIENT_ID?.trim()
  const clientSecret = (
    process.env.SHOPIFY_CLIENT_SECRET ??
    process.env.SHOPIFY_APP_CLIENT_SECRET
  )?.trim()

  if (!clientId || !clientSecret) {
    throw new Error('Shopify client credentials are not configured.')
  }

  const response = await fetch(
    `https://${configuration.storeDomain}/admin/oauth/access_token`,
    {
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    },
  )
  const payload = (await response.json().catch(() => null)) as ShopifyAccessTokenResponse | null
  const accessToken = payload?.access_token?.trim()

  if (!response.ok || !accessToken) {
    throw new Error(`Shopify token request failed with HTTP ${response.status}.`)
  }

  const lifetimeSeconds = typeof payload?.expires_in === 'number'
    ? payload.expires_in
    : 86_399

  cachedAccessToken = {
    expiresAt: Date.now() + Math.max(60, lifetimeSeconds - 60) * 1000,
    value: accessToken,
  }

  return accessToken
}

async function getShopifyAdminAccessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
    return cachedAccessToken.value
  }

  if (!pendingAccessToken) {
    pendingAccessToken = requestShopifyAdminAccessToken().finally(() => {
      pendingAccessToken = null
    })
  }

  return pendingAccessToken
}

async function getInventoryItem(inventoryItemId: string) {
  const configuration = getShopifyConfiguration()
  const accessToken = await getShopifyAdminAccessToken()

  const response = await fetch(
    `https://${configuration.storeDomain}/admin/api/${configuration.apiVersion}/graphql.json`,
    {
      body: JSON.stringify({
        query: inventoryItemQuery,
        variables: {
          id: `gid://shopify/InventoryItem/${inventoryItemId}`,
        },
      }),
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-shopify-access-token': accessToken,
      },
      method: 'POST',
    },
  )
  const payload = (await response.json().catch(() => null)) as ShopifyInventoryItemResponse | null

  if (!response.ok) {
    throw new Error(`Shopify Admin API responded with HTTP ${response.status}.`)
  }

  if (!payload) {
    throw new Error('Shopify Admin API returned an unreadable response.')
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message || 'Shopify rejected the inventory query.')
  }

  const item = payload.data?.inventoryItem

  if (!item) {
    throw new Error(`Shopify inventory item ${inventoryItemId} was not found.`)
  }

  if (item.inventoryLevels.pageInfo.hasNextPage) {
    throw new Error('The inventory item has more than 250 locations and cannot be totaled safely.')
  }

  const sku = item.sku?.trim().toUpperCase() ?? ''
  const inventoryQuantity = item.inventoryLevels.nodes.reduce((total, level) => {
    const available = level.quantities.find((quantity) => quantity.name === 'available')
    return total + (available?.quantity ?? 0)
  }, 0)

  return {
    inventoryQuantity: Math.max(0, Math.floor(inventoryQuantity)),
    sku,
  }
}

async function handler(request: Request) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const secret = (
    process.env.SHOPIFY_WEBHOOK_SECRET ??
    process.env.SHOPIFY_CLIENT_SECRET ??
    process.env.SHOPIFY_APP_CLIENT_SECRET
  )?.trim()
  const configuration = getShopifyConfiguration()
  const clientId = process.env.SHOPIFY_CLIENT_ID?.trim()
  const clientSecret = (
    process.env.SHOPIFY_CLIENT_SECRET ??
    process.env.SHOPIFY_APP_CLIENT_SECRET
  )?.trim()

  if (!secret || !configuration.configured || !clientId || !clientSecret) {
    return Response.json({ error: 'Shopify inventory webhook is not configured.' }, { status: 503 })
  }

  const rawBody = Buffer.from(await request.arrayBuffer())
  const signature = request.headers.get('x-shopify-hmac-sha256')
  const shopDomain = request.headers.get('x-shopify-shop-domain')?.trim().toLowerCase()
  const topic = request.headers.get('x-shopify-topic')?.trim().toLowerCase()
  const webhookId = request.headers.get('x-shopify-webhook-id')?.trim() ?? ''
  const hasRawBody = rawBody.length > 0
  const signatureValid = Boolean(signature && hasValidSignature(rawBody, signature, secret))
  const shopDomainMatches = shopDomain === configuration.storeDomain
  const topicMatches = topic === 'inventory_levels/update'

  if (!hasRawBody || !signatureValid || !shopDomainMatches || !topicMatches) {
    console.warn('Shopify inventory-levels-update webhook rejected', {
      bodyBytes: rawBody.length,
      configuredStoreDomain: configuration.storeDomain,
      hasSignature: Boolean(signature),
      secretSource: process.env.SHOPIFY_WEBHOOK_SECRET === undefined ? 'app' : 'webhook',
      shopDomain,
      shopDomainMatches,
      signatureValid,
      topic,
      topicMatches,
    })
    return Response.json({ error: 'Invalid Shopify webhook.' }, { status: 401 })
  }

  let inventoryLevel: ShopifyInventoryLevel

  try {
    inventoryLevel = JSON.parse(rawBody.toString('utf8')) as ShopifyInventoryLevel
  } catch {
    return Response.json({ error: 'Invalid Shopify inventory payload.' }, { status: 400 })
  }

  const inventoryItemId = String(inventoryLevel.inventory_item_id ?? '').trim()

  if (!inventoryItemId) {
    return Response.json({ error: 'Expected a Shopify inventory item ID.' }, { status: 400 })
  }

  const receipt = receiptPath(shopDomain, webhookId, rawBody)

  if (await receiptExists(receipt)) {
    return Response.json({ duplicate: true, ok: true })
  }

  const { inventoryQuantity, sku } = await getInventoryItem(inventoryItemId)

  if (!sku) {
    return Response.json({
      ok: true,
      reason: 'The Shopify inventory item does not have a SKU.',
      skipped: true,
    })
  }

  const manifests = await listLatestProductMediaManifests<ProductMediaAsset, CatalogProduct>()
  const loaded = manifests.find((manifest) =>
    !manifest.manifest.deletedAt &&
    manifest.manifest.product?.sku?.trim().toUpperCase() === sku
  )
  const product = loaded?.manifest.product

  if (!loaded || !product) {
    return Response.json({
      ok: true,
      reason: `No Vercel product matched Shopify SKU ${sku}.`,
      skipped: true,
      sku,
    })
  }

  await writeProductMediaManifest<ProductMediaAsset, CatalogProduct>(product.id, {
    assets: loaded.manifest.assets ?? [],
    product: {
      ...product,
      inventoryQuantity,
    },
  })

  const updated = {
    inventoryItemId,
    inventoryQuantity,
    productId: product.id,
    sku,
  }

  await put(
    receipt,
    JSON.stringify({
      processedAt: new Date().toISOString(),
      updated,
      webhookId: webhookId || undefined,
    }),
    {
      access: 'public',
      contentType: 'application/json',
    },
  )

  return Response.json({ ok: true, updated })
}

export default { fetch: handler }
