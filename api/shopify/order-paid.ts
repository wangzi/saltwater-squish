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
    SHOPIFY_WEBHOOK_SECRET?: string
  }
}

type ApiRequest = {
  body?: unknown
  headers: Record<string, string | string[] | undefined>
  method?: string
  rawBody?: Buffer
  [Symbol.asyncIterator]?: () => AsyncIterator<Buffer | string | Uint8Array>
}

type ApiResponse = {
  json: (body: unknown) => void
  status: (code: number) => ApiResponse
}

type ProductMediaAsset = Record<string, unknown>

type CatalogProduct = Record<string, unknown> & {
  id: string
  inventoryQuantity?: number
  sku: string
}

type ShopifyOrder = {
  financial_status?: string
  id?: number | string
  line_items?: Array<{
    quantity?: number
    sku?: string | null
  }>
}

export const config = {
  api: {
    bodyParser: false,
  },
}

function headerValue(request: ApiRequest, name: string) {
  const value = request.headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

async function readRawBody(request: ApiRequest) {
  if (Buffer.isBuffer(request.rawBody)) {
    return request.rawBody
  }

  if (!request[Symbol.asyncIterator]) {
    return null
  }

  const chunks: Buffer[] = []

  for await (const chunk of request as AsyncIterable<Buffer | string | Uint8Array>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}

function hasValidSignature(rawBody: Buffer, signature: string, secret: string) {
  const received = Buffer.from(signature, 'base64')
  const expected = createHmac('sha256', secret).update(rawBody).digest()

  return received.length === expected.length && timingSafeEqual(received, expected)
}

function quantitiesBySku(order: ShopifyOrder) {
  const quantities = new Map<string, number>()

  for (const lineItem of order.line_items ?? []) {
    const sku = lineItem.sku?.trim().toUpperCase()
    const quantity = typeof lineItem.quantity === 'number' && Number.isFinite(lineItem.quantity)
      ? Math.max(0, Math.floor(lineItem.quantity))
      : 0

    if (sku && quantity > 0) {
      quantities.set(sku, (quantities.get(sku) ?? 0) + quantity)
    }
  }

  return quantities
}

function receiptPath(shopDomain: string, orderId: string) {
  const key = createHash('sha256').update(`${shopDomain}:${orderId}`).digest('hex')
  return `shopify-webhook-receipts/orders-paid/${key}.json`
}

async function receiptExists(pathname: string) {
  const result = await list({ limit: 1, prefix: pathname })
  return result.blobs.some((blob) => blob.pathname === pathname)
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const secret = (
    process.env.SHOPIFY_WEBHOOK_SECRET ??
    process.env.SHOPIFY_APP_CLIENT_SECRET
  )?.trim()
  const configuration = getShopifyConfiguration()

  if (!secret || !configuration.configured) {
    return response.status(503).json({ error: 'Shopify webhook is not configured.' })
  }

  const rawBody = await readRawBody(request)
  const signature = headerValue(request, 'x-shopify-hmac-sha256')
  const shopDomain = headerValue(request, 'x-shopify-shop-domain')?.trim().toLowerCase()
  const topic = headerValue(request, 'x-shopify-topic')?.trim().toLowerCase()

  if (
    !rawBody ||
    !signature ||
    !hasValidSignature(rawBody, signature, secret) ||
    shopDomain !== configuration.storeDomain ||
    topic !== 'orders/paid'
  ) {
    return response.status(401).json({ error: 'Invalid Shopify webhook.' })
  }

  let order: ShopifyOrder

  try {
    order = JSON.parse(rawBody.toString('utf8')) as ShopifyOrder
  } catch {
    return response.status(400).json({ error: 'Invalid Shopify order payload.' })
  }

  const orderId = String(order.id ?? '').trim()

  if (!orderId || order.financial_status !== 'paid') {
    return response.status(400).json({ error: 'Expected a paid Shopify order.' })
  }

  const receipt = receiptPath(shopDomain, orderId)

  if (await receiptExists(receipt)) {
    return response.status(200).json({ duplicate: true, ok: true })
  }

  const soldBySku = quantitiesBySku(order)
  const manifests = await listLatestProductMediaManifests<ProductMediaAsset, CatalogProduct>()
  const manifestsBySku = new Map<string, (typeof manifests)[number]>()

  for (const manifest of manifests) {
    const sku = manifest.manifest.product?.sku?.trim().toUpperCase()

    if (!manifest.manifest.deletedAt && sku && !manifestsBySku.has(sku)) {
      manifestsBySku.set(sku, manifest)
    }
  }

  const updated: Array<{ inventoryQuantity: number; productId: string; sku: string }> = []
  const skipped: string[] = []

  for (const [sku, soldQuantity] of soldBySku) {
    const loaded = manifestsBySku.get(sku)
    const product = loaded?.manifest.product

    if (!loaded || !product || typeof product.inventoryQuantity !== 'number') {
      skipped.push(sku)
      continue
    }

    const inventoryQuantity = Math.max(
      0,
      Math.floor(product.inventoryQuantity) - soldQuantity,
    )

    await writeProductMediaManifest<ProductMediaAsset, CatalogProduct>(product.id, {
      assets: loaded.manifest.assets ?? [],
      product: {
        ...product,
        inventoryQuantity,
      },
    })
    updated.push({ inventoryQuantity, productId: product.id, sku })
  }

  await put(
    receipt,
    JSON.stringify({
      orderId,
      processedAt: new Date().toISOString(),
      skipped,
      updated,
    }),
    {
      access: 'public',
      contentType: 'application/json',
    },
  )

  return response.status(200).json({ ok: true, skipped, updated })
}
