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

export const catalogProducts: CatalogProduct[] = [
  {
    aliases: ['blue coconut oil ball'],
    categories: ['Coconut oil'],
    collection: 'Coconut Oil',
    description: 'A translucent blue coconut-oil ball with a smooth, glassy squeeze.',
    feel: 'Clear Jelly',
    id: 'blue-coconut-oil-ball',
    imagePosition: [0, 0],
    name: 'Blue Coconut Oil Ball',
    price: null,
    sku: 'SWS-COB-BLU',
    sortOrder: 10,
    status: 'published',
    subtitle: 'Clear gel ball',
    tag: 'Clear squeeze',
  },
  {
    aliases: ['pink coconut oil ball', 'coconut oil vid', 'cocnut oil vid'],
    categories: ['Coconut oil'],
    collection: 'Coconut Oil',
    description: 'A rosy clear coconut-oil ball with a slow, glossy fold.',
    feel: 'Clear Jelly',
    id: 'pink-coconut-oil-ball',
    imagePosition: [50, 0],
    name: 'Pink Coconut Oil Ball',
    price: null,
    sku: 'SWS-COB-PNK',
    sortOrder: 20,
    status: 'published',
    subtitle: 'Clear gel ball',
    tag: 'Clear squeeze',
  },
  {
    aliases: ['blue crunchy bead ball'],
    categories: ['Crunchy'],
    collection: 'Crunchy Beads',
    description: 'A cool-toned bead ball with a dense, satisfying crunch.',
    feel: 'Crunchy',
    id: 'blue-crunchy-bead-ball',
    imagePosition: [100, 0],
    name: 'Blue Crunchy Bead Ball',
    price: null,
    sku: 'SWS-CBB-BLU',
    sortOrder: 30,
    status: 'published',
    subtitle: 'Crunchy bead ball',
    tag: 'Crunchy',
  },
  {
    aliases: ['pink crunchy bead ball', 'crunchy', 'crunchy 1', 'crunchy 2'],
    categories: ['Crunchy'],
    collection: 'Crunchy Beads',
    description: 'A pale pink bead ball with a soft shell and crisp texture.',
    feel: 'Crunchy',
    id: 'pink-crunchy-bead-ball',
    imagePosition: [0, 100],
    name: 'Pink Crunchy Bead Ball',
    price: null,
    sku: 'SWS-CBB-PNK',
    sortOrder: 40,
    status: 'published',
    subtitle: 'Crunchy bead ball',
    tag: 'Crunchy',
  },
  {
    aliases: ['jumbo transparent vaseline cheese', 'jumbo clear cheese'],
    categories: ['Vaseline'],
    collection: 'Vaseline Cheese',
    description: 'A jumbo transparent cheese block with a weighty jelly squeeze.',
    feel: 'Clear Jelly',
    id: 'jumbo-transparent-vaseline-cheese',
    imagePosition: [50, 100],
    name: 'Jumbo Transparent Vaseline Cheese',
    price: null,
    sku: 'SWS-VC-JMB',
    sortOrder: 50,
    status: 'published',
    subtitle: 'Jumbo clear cheese',
    tag: 'Jumbo',
  },
  {
    aliases: ['mini vaseline cheese'],
    categories: ['Vaseline'],
    collection: 'Vaseline Cheese',
    description: 'A palm-size cream cheese block with a soft, compact press.',
    feel: 'Cloud Soft',
    id: 'mini-vaseline-cheese',
    imagePosition: [100, 100],
    name: 'Mini Vaseline Cheese',
    price: null,
    sku: 'SWS-VC-MIN',
    sortOrder: 60,
    status: 'published',
    subtitle: 'Mini cheese cube',
    tag: 'Mini',
  },
  {
    aliases: ['peach slushy', 'peach slushy ball', 'peach sluchy ball'],
    categories: ['Slushy'],
    collection: 'Slushy Balls',
    description: 'A peach-pink slushy ball with a cool, softly textured squeeze.',
    feel: 'Slushy',
    id: 'peach-slushy-ball',
    imagePosition: [0, 0],
    name: 'Peach Slushy Ball',
    price: null,
    sku: 'SWS-SLB-PCH',
    sortOrder: 70,
    status: 'published',
    subtitle: 'Peach slushy ball',
    tag: 'Slushy',
  },
  {
    aliases: ['pillow taba', 'pillow taba 2', 'pillow taba squishy'],
    categories: ['Taba'],
    collection: 'Cloud Soft',
    description: 'A white pillow-shaped taba with a quiet, pillowy return.',
    feel: 'Cloud Soft',
    id: 'pillow-taba-squishy',
    imagePosition: [50, 0],
    name: 'Pillow Taba Squishy',
    price: null,
    sku: 'SWS-TAB-WHT',
    sortOrder: 80,
    status: 'published',
    subtitle: 'Pillow-soft taba',
    tag: 'Cloud soft',
  },
  {
    aliases: ['pink slow rise bun', 'pink sticky bun'],
    categories: ['Slow rise'],
    collection: 'Slow Rise Bakery',
    description: 'A large pink bakery bun that rises back at an easy pace.',
    feel: 'Slow Rise',
    id: 'pink-slow-rise-bun',
    imagePosition: [100, 0],
    name: 'Pink Slow Rise Bun',
    price: null,
    sku: 'SWS-SRB-PNK',
    sortOrder: 90,
    status: 'published',
    subtitle: 'Slow-rise bun',
    tag: 'Slow rise',
  },
  {
    aliases: ['soymilk slow rise', 'soymilk slow rise bun', 'soymilk sloow rise'],
    categories: ['Slow rise'],
    collection: 'Slow Rise Bakery',
    description: 'A sunny soymilk bun with a plush, gradual rise.',
    feel: 'Slow Rise',
    id: 'soymilk-slow-rise-bun',
    imagePosition: [0, 100],
    name: 'Soymilk Slow Rise Bun',
    price: null,
    sku: 'SWS-SRB-SOY',
    sortOrder: 100,
    status: 'published',
    subtitle: 'Slow-rise bun',
    tag: 'Slow rise',
  },
  {
    aliases: ['slow rise soap', 'ss soap'],
    categories: ['Slow rise'],
    collection: 'Slow Rise',
    description: 'A clean white soap bar with a deep press and slow return.',
    feel: 'Slow Rise',
    id: 'slow-rise-soap',
    imagePosition: [50, 100],
    name: 'Slow Rise Soap',
    price: null,
    sku: 'SWS-SOAP-WHT',
    sortOrder: 110,
    status: 'published',
    subtitle: 'Slow-rise soap bar',
    tag: 'Slow rise',
  },
  {
    aliases: ['watermelon slushy ball'],
    categories: ['Slushy'],
    collection: 'Slushy Balls',
    description: 'A watermelon-red slushy ball with tiny seed details.',
    feel: 'Slushy',
    id: 'watermelon-slushy-ball',
    imagePosition: [100, 100],
    name: 'Watermelon Slushy Ball',
    price: null,
    sku: 'SWS-SLB-WML',
    sortOrder: 120,
    status: 'published',
    subtitle: 'Watermelon slushy ball',
    tag: 'Slushy',
  },
  {
    aliases: [
      'chiboki toothpaste',
      'chiboki toothpaste squishy',
      'photo jul 03 2026 10 49 53 am',
      'photo jul 03 2026 10 58 23 am',
    ],
    categories: ['Vaseline'],
    collection: 'Novelty',
    description: 'A playful Chiboki toothpaste squishy with its clear carry pouch.',
    feel: 'Cloud Soft',
    id: 'chiboki-toothpaste-squishy',
    imagePosition: [0, 0],
    name: 'Chiboki Toothpaste Squishy',
    price: null,
    sku: 'SWS-CHB-WHT',
    sortOrder: 130,
    status: 'published',
    subtitle: 'Toothpaste squishy',
    tag: 'Novelty',
  },
  {
    aliases: ['flan pudding', 'flan pudding squishy'],
    categories: ['Crunchy'],
    collection: 'Novelty',
    description: 'A caramel-topped flan pudding squishy with a crisp, crunchy shell.',
    feel: 'Crunchy',
    id: 'flan-pudding-squishy',
    imagePosition: [0, 0],
    name: 'Flan Pudding Squishy',
    price: null,
    sku: 'SWS-FLN-CRM',
    sortOrder: 140,
    status: 'published',
    subtitle: 'Flan pudding squishy',
    tag: 'Crunchy',
  },
]

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
  products: CatalogProduct[] = catalogProducts,
) {
  const normalizedFileName = normalizedAlias(fileName)

  if (!normalizedFileName) {
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
