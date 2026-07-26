export type CatalogFeel =
  | 'Clear Jelly'
  | 'Slow Rise'
  | 'Crunchy'
  | 'Slushy'
  | 'Cloud Soft'
  | 'Icy'

export type CatalogStatus = 'draft' | 'published'

export const productCategories = [
  'Slow rise',
  'Vaseline',
  'Coconut oil',
  'Crunchy',
  'Slushy',
  'Taba',
] as const

export type ProductCategory = (typeof productCategories)[number]

export type CatalogProduct = {
  aliases?: string[]
  availableForSale?: boolean
  categories?: ProductCategory[]
  collection: string
  currencyCode?: string
  description: string
  feel: CatalogFeel
  id: string
  imagePosition: [number, number]
  inventoryQuantity?: number
  name: string
  price: number | null
  sku: string
  shopifyHandle?: string
  shopifyProductId?: string
  shopifyVariantId?: string
  sortOrder: number
  status: CatalogStatus
  subtitle: string
  tag: string
}

function normalizedAlias(value: string) {
  return value
    .replace(/\.[^.]+$/, '')
    .trim()
    .toLowerCase()
    .replace(/\bcocnut\b/g, 'coconut')
    .replace(/\bsluchy\b/g, 'slushy')
    .replace(/\bsloow\b/g, 'slow')
    .replace(/\b(?:vid|video)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenScore(left: string, right: string) {
  const leftTokens = new Set(left.split(' ').filter(Boolean))
  const rightTokens = new Set(right.split(' ').filter(Boolean))

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0
  }

  let shared = 0
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      shared += 1
    }
  })

  return shared / Math.max(leftTokens.size, rightTokens.size)
}

export function matchProductIdFromFileName(
  fileName: string,
  products: CatalogProduct[],
) {
  const normalizedFileName = normalizedAlias(fileName)

  if (!normalizedFileName || products.length === 0) {
    return ''
  }

  const exactMatch = products.find((product) =>
    [product.name, ...(product.aliases ?? [])]
      .map(normalizedAlias)
      .includes(normalizedFileName),
  )

  if (exactMatch) {
    return exactMatch.id
  }

  const ranked = products
    .map((product) => ({
      id: product.id,
      score: Math.max(
        ...[product.name, ...(product.aliases ?? [])].map((alias) =>
          tokenScore(normalizedFileName, normalizedAlias(alias)),
        ),
      ),
    }))
    .sort((left, right) => right.score - left.score)

  if (ranked[0]?.score >= 0.72 && ranked[0].score > (ranked[1]?.score ?? 0)) {
    return ranked[0].id
  }

  return ''
}
