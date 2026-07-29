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

type ShopifyLineItem = {
  id?: number | string
  sku?: string | null
}

type ShopifyOrder = {
  id?: number | string
  line_items?: ShopifyLineItem[]
  refunds?: Array<{
    refund_line_items?: Array<{
      line_item?: ShopifyLineItem
      line_item_id?: number | string
      quantity?: number
      restock_type?: string
    }>
  }>
}

function hasValidSignature(rawBody: Buffer, signature: string, secret: string) {
  const received = Buffer.from(signature, 'base64')
  const expected = createHmac('sha256', secret).update(rawBody).digest()

  return received.length === expected.length && timingSafeEqual(received, expected)
}

function restockedQuantitiesBySku(order: ShopifyOrder) {
  const lineItemsById = new Map(
    (order.line_items ?? []).flatMap((lineItem) => {
      const id = String(lineItem.id ?? '').trim()
      return id ? [[id, lineItem] as const] : []
    }),
  )
  const quantities = new Map<string, number>()
  const restockTypes = new Set(['cancel', 'legacy_restock', 'return'])

  for (const refund of order.refunds ?? []) {
    for (const refundLineItem of refund.refund_line_items ?? []) {
      const restockType = refundLineItem.restock_type?.trim().toLowerCase()

      if (!restockType || !restockTypes.has(restockType)) {
        continue
      }

      const sourceLineItem = refundLineItem.line_item ??
        lineItemsById.get(String(refundLineItem.line_item_id ?? '').trim())
      const sku = sourceLineItem?.sku?.trim().toUpperCase()
      const quantity = typeof refundLineItem.quantity === 'number' &&
        Number.isFinite(refundLineItem.quantity)
        ? Math.max(0, Math.floor(refundLineItem.quantity))
        : 0

      if (sku && quantity > 0) {
        quantities.set(sku, (quantities.get(sku) ?? 0) + quantity)
      }
    }
  }

  return quantities
}

function receiptPath(topic: 'orders-cancelled' | 'orders-paid', shopDomain: string, orderId: string) {
  const key = createHash('sha256').update(`${shopDomain}:${orderId}`).digest('hex')
  return `shopify-webhook-receipts/${topic}/${key}.json`
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
  const topicMatches = topic === 'orders/cancelled'

  if (!hasRawBody || !signatureValid || !shopDomainMatches || !topicMatches) {
    console.warn('Shopify order-cancelled webhook rejected', {
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
    return Response.json({ error: 'Expected a cancelled Shopify order.' }, { status: 400 })
  }

  const cancellationReceipt = receiptPath('orders-cancelled', shopDomain, orderId)

  if (await receiptExists(cancellationReceipt)) {
    return Response.json({ duplicate: true, ok: true })
  }

  const paymentReceipt = receiptPath('orders-paid', shopDomain, orderId)

  if (!(await receiptExists(paymentReceipt))) {
    return Response.json({
      ignored: true,
      ok: true,
      reason: 'The paid-order webhook did not decrement this order.',
    })
  }

  const restockedBySku = restockedQuantitiesBySku(order)
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

  for (const [sku, restockedQuantity] of restockedBySku) {
    const loaded = manifestsBySku.get(sku)
    const product = loaded?.manifest.product

    if (!loaded || !product || typeof product.inventoryQuantity !== 'number') {
      skipped.push(sku)
      continue
    }

    const inventoryQuantity = Math.floor(product.inventoryQuantity) + restockedQuantity

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
    cancellationReceipt,
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
