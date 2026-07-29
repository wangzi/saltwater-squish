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

type ProductMediaAsset = Record<string, unknown>

type CatalogProduct = Record<string, unknown> & {
  id: string
  inventoryQuantity?: number
  sku: string
}

type ShopifyOrder = {
  id?: number | string
  line_items?: Array<{
    quantity?: number
    sku?: string | null
  }>
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

async function handler(request: Request) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const secret = (
    process.env.SHOPIFY_WEBHOOK_SECRET ??
    process.env.SHOPIFY_APP_CLIENT_SECRET
  )?.trim()
  const configuration = getShopifyConfiguration()

  if (!secret || !configuration.configured) {
    return Response.json({ error: 'Shopify webhook is not configured.' }, { status: 503 })
  }

  const rawBody = Buffer.from(await request.arrayBuffer())
  const signature = request.headers.get('x-shopify-hmac-sha256')
  const shopDomain = request.headers.get('x-shopify-shop-domain')?.trim().toLowerCase()
  const topic = request.headers.get('x-shopify-topic')?.trim().toLowerCase()
  const hasRawBody = rawBody.length > 0
  const signatureValid = Boolean(signature && hasValidSignature(rawBody, signature, secret))
  const shopDomainMatches = shopDomain === configuration.storeDomain
  const topicMatches = topic === 'orders/paid'

  if (!hasRawBody || !signatureValid || !shopDomainMatches || !topicMatches) {
    console.warn('Shopify order-paid webhook rejected', {
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

  let order: ShopifyOrder

  try {
    order = JSON.parse(rawBody.toString('utf8')) as ShopifyOrder
  } catch {
    return Response.json({ error: 'Invalid Shopify order payload.' }, { status: 400 })
  }

  const orderId = String(order.id ?? '').trim()

  if (!orderId) {
    return Response.json({ error: 'Expected a Shopify order ID.' }, { status: 400 })
  }

  const receipt = receiptPath(shopDomain, orderId)

  if (await receiptExists(receipt)) {
    return Response.json({ duplicate: true, ok: true })
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

  return Response.json({ ok: true, skipped, updated })
}

export default { fetch: handler }
