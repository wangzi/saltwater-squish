import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSupabaseAdmin, isSupabaseConfigured, type ProductRow } from './supabase.js'

export type ProductRecord = {
  aliases: string[]
  categories: string[]
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

export type ProductUpdateInput = {
  categories?: string[]
  inventoryQuantity?: number
  name?: string
  price?: number | null
}

const allowedFeels = new Set([
  'Clear Jelly',
  'Slow Rise',
  'Crunchy',
  'Slushy',
  'Cloud Soft',
  'Icy',
])

export const allowedCategories = new Set([
  'Slow rise',
  'Vaseline',
  'Coconut oil',
  'Crunchy',
  'Slushy',
  'Taba',
])

const seedPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../data/product-seed.json',
)

function readSeedProducts(): ProductRecord[] {
  const raw = readFileSync(seedPath, 'utf8')
  return JSON.parse(raw) as ProductRecord[]
}

export function mapProductRow(row: ProductRow): ProductRecord {
  return {
    aliases: row.aliases ?? [],
    categories: (row.categories ?? []).filter((category): category is string => (
      typeof category === 'string'
    )),
    collection: row.collection,
    description: row.description,
    feel: allowedFeels.has(row.feel) ? row.feel : 'Cloud Soft',
    id: row.id,
    imagePosition: [row.image_position_x, row.image_position_y],
    inventoryQuantity: typeof row.inventory_quantity === 'number'
      ? Math.max(0, Math.floor(row.inventory_quantity))
      : undefined,
    name: row.name,
    price: typeof row.price === 'number' && Number.isFinite(row.price)
      ? Math.round(row.price * 100) / 100
      : null,
    sku: row.sku,
    sortOrder: row.sort_order,
    status: row.status === 'draft' ? 'draft' : 'published',
    subtitle: row.subtitle,
    tag: row.tag,
  }
}

function mapProductToRow(product: ProductRecord) {
  return {
    aliases: product.aliases,
    categories: product.categories,
    collection: product.collection,
    description: product.description,
    feel: product.feel,
    id: product.id,
    image_position_x: product.imagePosition[0],
    image_position_y: product.imagePosition[1],
    inventory_quantity: product.inventoryQuantity ?? null,
    name: product.name,
    price: product.price,
    sku: product.sku,
    sort_order: product.sortOrder,
    status: product.status,
    subtitle: product.subtitle,
    tag: product.tag,
  }
}

function cleanProductId(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '')
    : ''
}

function cleanName(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 100) : ''
}

function cleanPrice(value: unknown) {
  if (value === null) {
    return null
  }

  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value * 100) / 100
    : undefined
}

function cleanInventoryQuantity(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : undefined
}

function cleanCategories(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined
  }

  return [...new Set(value.filter((item): item is string => (
    typeof item === 'string' && allowedCategories.has(item)
  )))]
}

export async function listProducts({ includeDrafts = false } = {}) {
  if (!isSupabaseConfigured()) {
    const products = readSeedProducts()
      .filter((product) => includeDrafts || product.status === 'published')
      .sort((left, right) => left.sortOrder - right.sortOrder)

    return { products, source: 'seed' as const }
  }

  let query = getSupabaseAdmin()
    .from('products')
    .select('*')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  if (!includeDrafts) {
    query = query.eq('status', 'published')
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return {
    products: (data as ProductRow[]).map(mapProductRow),
    source: 'supabase' as const,
  }
}

export async function getProduct(productId: string) {
  const normalizedId = cleanProductId(productId)

  if (!normalizedId) {
    return null
  }

  if (!isSupabaseConfigured()) {
    return readSeedProducts().find((product) => product.id === normalizedId) ?? null
  }

  const { data, error } = await getSupabaseAdmin()
    .from('products')
    .select('*')
    .eq('id', normalizedId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ? mapProductRow(data as ProductRow) : null
}

export async function updateProduct(productId: string, input: ProductUpdateInput) {
  const normalizedId = cleanProductId(productId)

  if (!normalizedId) {
    throw new Error('Choose a valid product.')
  }

  const name = input.name === undefined ? undefined : cleanName(input.name)
  const categories = input.categories === undefined ? undefined : cleanCategories(input.categories)
  const price = input.price === undefined ? undefined : cleanPrice(input.price)
  const inventoryQuantity = input.inventoryQuantity === undefined
    ? undefined
    : cleanInventoryQuantity(input.inventoryQuantity)

  if (
    name === undefined
    && categories === undefined
    && price === undefined
    && inventoryQuantity === undefined
  ) {
    throw new Error('Enter valid product changes.')
  }

  if (name !== undefined && !name) {
    throw new Error('Enter a product name.')
  }

  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.')
  }

  const existing = await getProduct(normalizedId)

  if (!existing) {
    throw new Error('Product not found.')
  }

  const patch: Record<string, unknown> = {}

  if (name !== undefined) {
    patch.name = name
  }

  if (categories !== undefined) {
    patch.categories = categories
  }

  if (price !== undefined) {
    patch.price = price
  }

  if (inventoryQuantity !== undefined) {
    patch.inventory_quantity = inventoryQuantity
  }

  const { data, error } = await getSupabaseAdmin()
    .from('products')
    .update(patch)
    .eq('id', normalizedId)
    .is('deleted_at', null)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return mapProductRow(data as ProductRow)
}

export async function deleteProduct(productId: string) {
  const normalizedId = cleanProductId(productId)

  if (!normalizedId) {
    throw new Error('Choose a valid product.')
  }

  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.')
  }

  const deletedAt = new Date().toISOString()
  const { data, error } = await getSupabaseAdmin()
    .from('products')
    .update({ deleted_at: deletedAt })
    .eq('id', normalizedId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error('Product not found.')
  }

  return { deletedAt, id: normalizedId }
}

export async function createProduct(product: ProductRecord) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.')
  }

  const normalizedId = cleanProductId(product.id)
  const name = cleanName(product.name)
  const sku = typeof product.sku === 'string' ? product.sku.trim().toUpperCase() : ''

  if (!normalizedId || !name || !sku) {
    throw new Error('Enter a valid product id, name, and SKU.')
  }

  const { data, error } = await getSupabaseAdmin()
    .from('products')
    .insert(mapProductToRow({ ...product, id: normalizedId, name, sku }))
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return mapProductRow(data as ProductRow)
}

export async function seedProductsFromFile() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.')
  }

  const products = readSeedProducts()
  const { error } = await getSupabaseAdmin()
    .from('products')
    .upsert(products.map(mapProductToRow), { onConflict: 'id' })

  if (error) {
    throw new Error(error.message)
  }

  return products.length
}
