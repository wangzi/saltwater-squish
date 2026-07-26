import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const seedPath = path.join(root, 'data/product-seed.json')
const url = process.env.SUPABASE_URL?.trim()
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!url || !serviceRoleKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before seeding products.')
  process.exit(1)
}

const products = JSON.parse(readFileSync(seedPath, 'utf8'))
const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const rows = products.map((product) => ({
  aliases: product.aliases ?? [],
  categories: product.categories ?? [],
  collection: product.collection,
  description: product.description,
  feel: product.feel,
  id: product.id,
  image_position_x: product.imagePosition?.[0] ?? 0,
  image_position_y: product.imagePosition?.[1] ?? 0,
  inventory_quantity: product.inventoryQuantity ?? null,
  name: product.name,
  price: product.price,
  sku: product.sku,
  sort_order: product.sortOrder,
  status: product.status ?? 'published',
  subtitle: product.subtitle,
  tag: product.tag,
}))

const { error } = await supabase.from('products').upsert(rows, { onConflict: 'id' })

if (error) {
  console.error(error.message)
  process.exit(1)
}

console.log(`Seeded ${rows.length} products.`)
