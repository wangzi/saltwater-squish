import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  Check,
  ExternalLink,
  Film,
  FishSymbol,
  Heart,
  Lock,
  MapPin,
  Maximize2,
  Menu,
  Minimize2,
  Minus,
  Pause,
  Package,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Shell,
  ShoppingBag,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  TriangleAlert,
  Turtle,
  Upload,
  Waves,
  X,
  MoonStar,
} from 'lucide-react'
import { type PutBlobResult } from '@vercel/blob'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react'
import './App.css'
import brandMark from './assets/optimized/saltwater-squish-mark.webp?no-inline'
import heroImage from './assets/optimized/hero-beach-squish.jpg'
import heroImageWebp from './assets/optimized/hero-beach-squish.webp'
import aboutBeachPhoto from './assets/optimized/ira-joni-half-moon-bay.jpg'
import aboutBeachPhotoWebp from './assets/optimized/ira-joni-half-moon-bay.webp'
import productSheet from './assets/optimized/product-sheet.webp'
import blueDaddyShark from './assets/generated/blue-daddy-shark.webp'
import pinkShark from './assets/generated/pink-shark.webp'
import purpleMamaShark from './assets/generated/purple-mama-shark.webp'
import reefFishAqua from './assets/optimized/reef-fish-aqua.png'
import reefFishCoral from './assets/optimized/reef-fish-coral.png'
import reefFishSun from './assets/optimized/reef-fish-sun.png'
import turtleMascot from './assets/generated/sea-turtle-topdown-v2.webp'
import {
  catalogProducts,
  matchProductIdFromFileName,
  productCategories,
  type CatalogProduct,
  type ProductCategory,
} from './productCatalog'
import { productSkuNameFromFileName } from './productSku'

type CategoryFilter = 'All' | ProductCategory
type Product = CatalogProduct

type ProductMediaKind = 'image' | 'video'

type ProductImageVariant = {
  contentType: 'image/webp'
  height?: number
  size: number
  url: string
  width: number
}

type ProductMedia = {
  contentType?: string
  downloadUrl?: string
  id: string
  kind: ProductMediaKind
  pathname?: string
  productId: string
  size?: number
  sortOrder?: number
  skuName?: string
  title?: string
  uploadedAt?: string
  url: string
  variants?: ProductImageVariant[]
}

type ProductMediaByProduct = Record<string, ProductMedia[]>

type Cart = Record<string, number>

type PolicyKind = 'shipping' | 'returns' | 'safety'

type ThemeMode = 'day' | 'night'

type Splash = {
  id: number
  x: number
  y: number
  size: number
}

type Flight = {
  id: number
  product: Product
  fromX: number
  fromY: number
  toX: number
  toY: number
}

type StudioBrush = {
  id: string
  name: string
  subtitle: string
  creatureAlt: string
  creatureImage: string
  creatureGlow: string
  stamp: 'crab' | 'turtle' | 'snail'
  size: number
  voice: string
}

type StudioPoint = {
  x: number
  y: number
  time: number
}

type StudioBounds = {
  left: number
  top: number
  width: number
  height: number
}

type StudioCreatureActor = {
  brush: StudioBrush
  direction: number
  facing: -1 | 1
  id: string
  lastTrailAt: number
  nextWanderAt: number
  phase: number
  speed: number
  step: number
  targetX: number
  targetY: number
  vx: number
  vy: number
  x: number
  y: number
}

type StudioAttractor = {
  id: number
  time: number
  x: number
  y: number
}

type TextStamp = {
  height: number
  text: string
  width: number
  x: number
  y: number
}

type DropFilm = {
  id: string
  title: string
  durationSeconds?: number
  downloadUrl?: string
  pathname?: string
  size?: number
  source: 'placeholder' | 'uploaded'
  uploadedAt?: string
  url?: string
}

type DropFilmsResponse = {
  films?: Array<Omit<DropFilm, 'source'>>
  source?: string
}

type ProductMediaResponse = {
  mediaByProduct?: ProductMediaByProduct
  products?: Product[]
  source?: string
}

type ShopifyCatalogVariant = {
  availableForSale: boolean
  currencyCode: string
  handle: string
  price: string
  productId: string
  productTitle: string
  variantId: string
  variantTitle: string
}

type ShopifyCatalogResponse = {
  configured?: boolean
  productsBySku?: Record<string, ShopifyCatalogVariant>
}

type ShopifyCartResponse = {
  checkoutUrl?: string
  error?: string
}

type PendingProductMediaFile = {
  file: File
  id: string
  productId: string
}

const maxDropFilmBytes = 150 * 1024 * 1024
const maxProductMediaBytes = 150 * 1024 * 1024
const maxDropFilmSeconds = 30
const dropFilmDurationTolerance = 0.85
const studioPixelRatioCap = 1
const studioTextLineHeight = 50
const studioTextSize = 40
const studioAttractorLifetime = 8400
const studioActorPadding = 88
const studioActorBottomPadding = 170
const acceptedDropFilmTypes = ['video/mp4', 'video/webm', 'video/quicktime']
const acceptedProductMediaTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]

const themeStorageKey = 'saltwater-squish-theme'

function getInitialThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'day'
  }

  try {
    const savedTheme = window.localStorage.getItem(themeStorageKey)
    return savedTheme === 'night' ? 'night' : 'day'
  } catch {
    return 'day'
  }
}

function scheduleIdleTask(task: () => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const idleWindow = window as Window & {
    cancelIdleCallback?: (handle: number) => void
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  }

  if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
    const handle = idleWindow.requestIdleCallback(task, { timeout: 1200 })
    return () => idleWindow.cancelIdleCallback?.(handle)
  }

  const handle = window.setTimeout(task, 700)
  return () => window.clearTimeout(handle)
}

const categoryFilters: CategoryFilter[] = ['All', ...productCategories]

const placeholderDropFilms: DropFilm[] = [
  {
    id: 'sea-glass-squeeze',
    title: 'Sea Glass Squeeze',
    durationSeconds: 30,
    source: 'placeholder',
  },
  {
    id: 'slow-rise-shore',
    title: 'Slow Rise Shore',
    durationSeconds: 29,
    source: 'placeholder',
  },
  {
    id: 'pearl-pop-test',
    title: 'Pearl Pop Test',
    durationSeconds: 28,
    source: 'placeholder',
  },
  {
    id: 'beach-bag-bundle',
    title: 'Coastal Drop Bundle',
    durationSeconds: 30,
    source: 'placeholder',
  },
  {
    id: 'clicker-freebie',
    title: 'Clicker Freebie',
    durationSeconds: 27,
    source: 'placeholder',
  },
]

const studioBrushes: StudioBrush[] = [
  {
    id: 'turtle-stamp',
    name: 'Turtle Stamp',
    subtitle: 'shell press',
    creatureAlt: 'Aqua sea turtle mascot',
    creatureGlow: 'rgba(174, 232, 230, 0.62)',
    creatureImage: turtleMascot,
    size: 78,
    stamp: 'turtle',
    voice: 'Turtle Stamp pressed a soft shell mark.',
  },
]

function studioCreatureDisplaySize(brush: StudioBrush) {
  return brush.size * (brush.stamp === 'turtle' ? 2.05 : brush.stamp === 'snail' ? 1.24 : 1.2)
}

const ambientBubbles = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  x: (index * 37 + 12) % 100,
  y: (index * 53 + 8) % 100,
  size: 18 + ((index * 17) % 68),
  delay: -1 * ((index * 11) % 24),
  duration: 16 + ((index * 7) % 18),
  depth: 0.35 + ((index * 13) % 55) / 100,
}))

const currency = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  style: 'currency',
  maximumFractionDigits: 2,
})

function productNameFromMedia(product: Product, media: ProductMedia[] = []) {
  if (product.sku && product.name.trim()) {
    return product.name
  }

  for (const item of media) {
    const resolvedName = item.skuName?.trim() || productSkuNameFromFileName(item.title ?? '')

    if (resolvedName) {
      return resolvedName
    }
  }

  return product.name
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  return slug || 'drop-film'
}

function fileExtensionFromName(fileName: string) {
  const extension = fileName.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase()

  if (extension === 'mp4' || extension === 'webm' || extension === 'mov') {
    return extension
  }

  return 'mp4'
}

function createDropFilmPath(title: string, file: File) {
  const extension = fileExtensionFromName(file.name)
  return `drop-films/${Date.now()}-${slugify(title)}.${extension}`
}

function productMediaExtensionFromName(fileName: string, kind: ProductMediaKind) {
  const extension = fileName.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase()
  const allowedImageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif']
  const allowedVideoExtensions = ['mp4', 'webm', 'mov']

  if (extension && kind === 'image' && allowedImageExtensions.includes(extension)) {
    return extension
  }

  if (extension && kind === 'video' && allowedVideoExtensions.includes(extension)) {
    return extension
  }

  return kind === 'image' ? 'jpg' : 'mp4'
}

function productMediaKindFromFile(file: File): ProductMediaKind | null {
  if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(file.name)) {
    return 'image'
  }

  if (file.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file.name)) {
    return 'video'
  }

  return null
}

function createProductMediaPath(productId: string, file: File, index = 0) {
  const kind = productMediaKindFromFile(file) ?? 'image'
  const extension = productMediaExtensionFromName(file.name, kind)
  const fileName = file.name.replace(/\.[^.]+$/, '')
  const suffix = index > 0 ? `-${index + 1}` : ''

  return `product-media/${productId}/${Date.now()}-${slugify(fileName)}${suffix}.${extension}`
}

function formatDuration(seconds?: number) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
    return '0:30 max'
  }

  const roundedSeconds = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(roundedSeconds / 60)
  const remainingSeconds = roundedSeconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function formatFileSize(bytes?: number) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) {
    return 'Ready for upload'
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }

  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`
}

function isAcceptedDropFilmFile(file: File) {
  return acceptedDropFilmTypes.includes(file.type) || /\.(mp4|mov|webm)$/i.test(file.name)
}

function isAcceptedProductMediaFile(file: File) {
  return (
    acceptedProductMediaTypes.includes(file.type) ||
    /\.(jpe?g|png|webp|gif|mp4|mov|webm)$/i.test(file.name)
  )
}

function readVideoDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement('video')
    const objectUrl = URL.createObjectURL(file)

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl)
      video.removeAttribute('src')
      video.load()
    }

    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const duration = video.duration
      cleanup()

      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error('Could not read the video duration. Try exporting as MP4, MOV, or WebM.'))
        return
      }

      resolve(duration)
    }
    video.onerror = () => {
      cleanup()
      reject(new Error('Could not open that video file. Try MP4, MOV, or WebM.'))
    }
    video.src = objectUrl
  })
}

function normalizeDropFilms(response: DropFilmsResponse) {
  const uploadedFilms = response.films
    ?.filter((film) => film.url)
    .map((film) => ({
      ...film,
      id: film.pathname ?? film.url ?? film.id,
      source: 'uploaded' as const,
    }))

  return uploadedFilms && uploadedFilms.length > 0 ? uploadedFilms : placeholderDropFilms
}

function compareProductMedia(left: ProductMedia, right: ProductMedia) {
  const leftOrder = typeof left.sortOrder === 'number' ? left.sortOrder : Number.MAX_SAFE_INTEGER
  const rightOrder = typeof right.sortOrder === 'number' ? right.sortOrder : Number.MAX_SAFE_INTEGER

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder
  }

  if (left.kind !== right.kind) {
    return left.kind === 'image' ? -1 : 1
  }

  const leftTime = left.uploadedAt ? new Date(left.uploadedAt).getTime() : 0
  const rightTime = right.uploadedAt ? new Date(right.uploadedAt).getTime() : 0
  return rightTime - leftTime
}

function normalizeProductMedia(response: ProductMediaResponse): ProductMediaByProduct {
  const mediaByProduct = response.mediaByProduct ?? {}

  return Object.fromEntries(
    Object.entries(mediaByProduct).map(([productId, media]) => [
      productId,
      media
        .filter((item) => item.url && (item.kind === 'image' || item.kind === 'video'))
        .map((item) => ({
          ...item,
          id: item.pathname ?? item.id ?? item.url,
          productId,
          skuName: item.skuName?.trim() || productSkuNameFromFileName(item.title ?? ''),
        }))
        .sort(compareProductMedia),
    ]),
  )
}

function normalizeCatalogProducts(response: ProductMediaResponse) {
  if (!Array.isArray(response.products) || response.products.length === 0) {
    return catalogProducts
  }

  const seedById = new Map(catalogProducts.map((product) => [product.id, product]))

  return response.products
    .map((product) => {
      const seed = seedById.get(product.id)

      return {
        ...(seed ?? product),
        ...product,
        aliases: product.aliases ?? seed?.aliases ?? [],
        categories: product.categories ?? seed?.categories ?? [],
        imagePosition: product.imagePosition ?? seed?.imagePosition ?? [0, 0],
        price:
          typeof product.price === 'number' && Number.isFinite(product.price)
            ? product.price
            : null,
      } satisfies Product
    })
    .sort((left, right) => left.sortOrder - right.sortOrder)
}

function KineticText({
  lines,
  tone = 'shore',
}: {
  lines: string[]
  tone?: 'lagoon' | 'shore'
}) {
  let characterIndex = 0
  const kineticColors = tone === 'lagoon'
    ? ['#fbf6ea', '#f6e8ce', '#c5e0d1', '#9cd6c8', '#e8ceb3', '#ffffff']
    : ['#4c5956', '#527b76', '#5c8580', '#5caea8', '#716f66', '#4f7d78']

  return (
    <span aria-hidden="true" className={`kinetic-text kinetic-text-${tone}`}>
      {lines.map((line, lineIndex) => (
        <span className="kinetic-line" key={`${lineIndex}-${line}`}>
          {line.split(' ').map((word, wordIndex) => (
            <span className="kinetic-word" key={`${lineIndex}-${wordIndex}-${word}`}>
              {Array.from(word).map((character, wordCharacterIndex) => {
                const index = characterIndex
                const color = kineticColors[index % kineticColors.length]
                const nextColor = kineticColors[(index + 2) % kineticColors.length]
                characterIndex += 1

                return (
                  <span
                    className="kinetic-letter"
                    key={`${character}-${wordCharacterIndex}`}
                    style={{
                      '--kinetic-delay': `${index * -0.11}s`,
                      '--kinetic-color': color,
                      '--kinetic-index': index,
                      '--kinetic-next-color': nextColor,
                    } as CSSProperties}
                  >
                    {character}
                  </span>
                )
              })}
            </span>
          ))}
        </span>
      ))}
    </span>
  )
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setPrefersReducedMotion(media.matches)

    updatePreference()
    media.addEventListener('change', updatePreference)

    return () => media.removeEventListener('change', updatePreference)
  }, [])

  return prefersReducedMotion
}

function ProductVisual({
  autoPlay = false,
  controls = false,
  imageSizes = '(max-width: 720px) calc(100vw - 36px), (max-width: 1120px) 50vw, 33vw',
  loop = false,
  media,
  poster,
  product,
  className = '',
  style,
}: {
  autoPlay?: boolean
  controls?: boolean
  imageSizes?: string
  loop?: boolean
  media?: ProductMedia
  poster?: string
  product: Product
  className?: string
  style?: CSSProperties
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hasMedia = Boolean(media?.url)
  const imageVariants = media?.kind === 'image'
    ? [...(media.variants ?? [])].sort((left, right) => left.width - right.width)
    : []
  const largestImageVariant = imageVariants.at(-1)
  const imageSource = largestImageVariant?.url ?? media?.url
  const imageSrcSet = imageVariants.length > 0
    ? imageVariants.map((variant) => `${variant.url} ${variant.width}w`).join(', ')
    : undefined
  const productStyle = hasMedia
    ? style
    : {
    ...style,
    backgroundImage: `url(${productSheet})`,
    backgroundPosition: `${product.imagePosition[0]}% ${product.imagePosition[1]}%`,
  }

  useEffect(() => {
    const video = videoRef.current

    if (!video) {
      return
    }

    if (autoPlay) {
      void video.play().catch(() => {})
      return
    }

    video.pause()
    video.currentTime = 0
  }, [autoPlay, media?.url])

  return (
    <span
      aria-label={product.name}
      className={`product-visual ${hasMedia ? 'has-uploaded-media' : ''} ${className}`}
      role="img"
      style={productStyle}
    >
      {media?.kind === 'image' ? (
        <img
          alt=""
          decoding="async"
          fetchPriority="low"
          height={largestImageVariant?.height}
          loading="lazy"
          sizes={imageSrcSet ? imageSizes : undefined}
          src={imageSource}
          srcSet={imageSrcSet}
          width={largestImageVariant?.width}
        />
      ) : null}
      {media?.kind === 'video' ? (
        <video
          autoPlay={autoPlay}
          controls={controls}
          loop={loop}
          muted
          playsInline
          poster={poster}
          preload={controls || autoPlay ? 'metadata' : 'none'}
          ref={videoRef}
          src={controls || autoPlay ? media.url : undefined}
        />
      ) : null}
    </span>
  )
}

function ProductMediaGallery({
  media,
  product,
}: {
  media: ProductMedia[]
  product: Product
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isHoverPreviewing, setIsHoverPreviewing] = useState(false)
  const leadImage = media.find((item) => item.kind === 'image')
  const firstVideoIndex = media.findIndex((item) => item.kind === 'video')
  const displayedIndex = isHoverPreviewing && firstVideoIndex >= 0
    ? firstVideoIndex
    : activeIndex
  const activeMedia = media[displayedIndex]

  const startHoverPreview = () => {
    if (
      firstVideoIndex < 0 ||
      !window.matchMedia('(hover: hover) and (pointer: fine)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }

    setIsHoverPreviewing(true)
  }

  const stopHoverPreview = () => setIsHoverPreviewing(false)

  useEffect(() => {
    if (activeIndex >= media.length) {
      setActiveIndex(0)
    }
  }, [activeIndex, media.length])

  if (media.length === 0) {
    return <ProductVisual product={product} />
  }

  return (
    <div className="product-media-gallery">
      <div
        className="product-media-hover-target"
        data-has-video={firstVideoIndex >= 0}
        data-hover-playing={isHoverPreviewing}
        onMouseEnter={startHoverPreview}
        onMouseLeave={stopHoverPreview}
      >
        <ProductVisual
          autoPlay={isHoverPreviewing}
          controls={!isHoverPreviewing}
          loop={isHoverPreviewing}
          className="product-media-main"
          media={activeMedia}
          imageSizes="(max-width: 720px) calc(100vw - 36px), (max-width: 1120px) 50vw, 33vw"
          poster={leadImage?.url}
          product={product}
        />
        {firstVideoIndex >= 0 && !isHoverPreviewing ? (
          <span aria-hidden="true" className="product-hover-video-cue">
            <Play size={15} />
          </span>
        ) : null}
      </div>
      {media.length > 1 ? (
        <div className="product-media-strip" aria-label={`${product.name} media`}>
          {media.map((item, index) => (
            <button
              aria-label={`Show ${item.kind} ${index + 1} for ${product.name}`}
              aria-pressed={activeIndex === index}
              className="product-media-thumb"
              key={item.id}
              onClick={() => {
                setIsHoverPreviewing(false)
                setActiveIndex(index)
              }}
              type="button"
            >
              <ProductVisual
                imageSizes="96px"
                media={item.kind === 'video' ? leadImage ?? item : item}
                product={product}
              />
              {item.kind === 'video' ? <Play aria-hidden="true" size={13} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function OceanBubbleField({ fieldRef }: { fieldRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div aria-hidden="true" className="ocean-bubble-field" ref={fieldRef}>
      {ambientBubbles.map((bubble) => {
        const style = {
          '--bubble-delay': `${bubble.delay}s`,
          '--bubble-duration': `${bubble.duration}s`,
          '--bubble-size': `${bubble.size}px`,
          '--bubble-x': `${bubble.x}%`,
          '--bubble-y': `${bubble.y}%`,
          '--repel-x': '0px',
          '--repel-y': '0px',
        } as CSSProperties

        return <span className="foam-bubble" key={bubble.id} style={style} />
      })}
    </div>
  )
}

function resetStudioCanvas(canvas: HTMLCanvasElement | null) {
  if (!canvas) {
    return
  }

  const rect = canvas.getBoundingClientRect()
  const width = Math.max(rect.width, 1)
  const height = Math.max(rect.height, 1)
  const scale = Math.min(window.devicePixelRatio || 1, studioPixelRatioCap)
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)

  const context = canvas.getContext('2d')

  if (!context) {
    return
  }

  context.setTransform(scale, 0, 0, scale, 0, 0)
  context.clearRect(0, 0, width, height)
  context.fillStyle = '#f0d9ad'
  context.fillRect(0, 0, width, height)

  const paperGradient = context.createLinearGradient(0, 0, width, height)
  paperGradient.addColorStop(0, 'rgba(255, 248, 228, 0.72)')
  paperGradient.addColorStop(0.46, 'rgba(225, 193, 136, 0.18)')
  paperGradient.addColorStop(1, 'rgba(196, 151, 86, 0.2)')
  context.fillStyle = paperGradient
  context.fillRect(0, 0, width, height)

  const grainCount = Math.min(320, Math.max(160, Math.round((width * height) / 1800)))

  for (let index = 0; index < grainCount; index += 1) {
    const x = (index * 47) % width
    const y = (index * 83) % height
    const alpha = 0.045 + ((index * 11) % 26) / 1000
    const tone = index % 4 === 0 ? '88, 61, 35' : '255, 250, 232'
    context.fillStyle = `rgba(${tone}, ${alpha})`
    context.fillRect(x, y, index % 5 === 0 ? 2 : 1, 1)
  }

  context.save()
  context.globalAlpha = 0.24
  context.lineWidth = 1.4

  for (let line = 0; line < 5; line += 1) {
    const y = height * (0.52 + line * 0.075)
    context.strokeStyle = line % 2 === 0 ? 'rgba(128, 88, 54, 0.2)' : 'rgba(255, 249, 234, 0.34)'
    context.beginPath()
    context.moveTo(width * 0.06, y)
    context.bezierCurveTo(
      width * 0.24,
      y - 22 + line * 2,
      width * 0.58,
      y + 18 - line * 4,
      width * 0.94,
      y - 8,
    )
    context.stroke()
  }
  context.restore()
}

function resetStudioLayer(canvas: HTMLCanvasElement | null) {
  if (!canvas) {
    return
  }

  const rect = canvas.getBoundingClientRect()
  const width = Math.max(rect.width, 1)
  const height = Math.max(rect.height, 1)
  const scale = Math.min(window.devicePixelRatio || 1, studioPixelRatioCap)
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)

  const context = canvas.getContext('2d')

  if (!context) {
    return
  }

  context.setTransform(scale, 0, 0, scale, 0, 0)
  context.clearRect(0, 0, width, height)
}

function clearStudioSurface(
  paintCanvas: HTMLCanvasElement | null,
  shimmerCanvas?: HTMLCanvasElement | null,
) {
  resetStudioCanvas(paintCanvas)
  resetStudioLayer(shimmerCanvas ?? null)
}

function canvasPointFromClient(
  bounds: StudioBounds,
  clientX: number,
  clientY: number,
  time = performance.now(),
): StudioPoint {
  return {
    time,
    x: clientX - bounds.left,
    y: clientY - bounds.top + 10,
  }
}

function fadeSandLift(canvas: HTMLCanvasElement | null) {
  if (!canvas) {
    return
  }

  const context = canvas.getContext('2d')

  if (!context) {
    return
  }

  context.save()
  context.globalCompositeOperation = 'destination-out'
  context.globalAlpha = 0.038
  context.fillStyle = 'rgba(0, 0, 0, 1)'
  context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight)
  context.restore()
}

function drawSandLift(
  canvas: HTMLCanvasElement | null,
  point: StudioPoint,
  brush: StudioBrush,
  velocity: number,
) {
  if (!canvas) {
    return
  }

  const context = canvas.getContext('2d')

  if (!context) {
    return
  }

  const speedFade = Math.max(0.24, 1 - Math.min(velocity / 1.4, 0.76))
  const flecks = 2

  context.save()
  context.globalCompositeOperation = 'source-over'

  for (let index = 0; index < flecks; index += 1) {
    const radius = (1.1 + Math.random() * 2.8) * speedFade
    const x = point.x + (Math.random() - 0.5) * brush.size * 1.5
    const y = point.y + (Math.random() - 0.5) * brush.size * 1.1

    context.globalAlpha = 0.18 + speedFade * 0.2
    context.fillStyle = index % 2 === 0 ? 'rgba(255, 249, 234, 0.88)' : 'rgba(151, 104, 55, 0.22)'
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()

    context.globalAlpha = 0.16
    context.strokeStyle = 'rgba(113, 77, 44, 0.18)'
    context.lineWidth = 0.7
    context.stroke()
  }

  context.restore()
}

function drawCreatureStampShape(
  context: CanvasRenderingContext2D,
  stamp: StudioBrush['stamp'],
  size: number,
  options: {
    fillStyle: string
    lineWidth: number
    strokeStyle: string
  },
) {
  context.fillStyle = options.fillStyle
  context.strokeStyle = options.strokeStyle
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.lineWidth = options.lineWidth

  if (stamp === 'crab') {
    context.beginPath()
    context.ellipse(0, 0, size * 0.28, size * 0.18, 0, 0, Math.PI * 2)
    context.fill()
    context.stroke()

    ;[-1, 1].forEach((side) => {
      context.beginPath()
      context.ellipse(side * size * 0.38, -size * 0.07, size * 0.12, size * 0.08, side * 0.45, 0, Math.PI * 2)
      context.fill()
      context.stroke()

      for (let leg = 0; leg < 3; leg += 1) {
        const startY = -size * 0.08 + leg * size * 0.08
        const endX = side * size * (0.34 + leg * 0.05)
        const endY = size * (0.17 + leg * 0.04)
        context.beginPath()
        context.moveTo(side * size * 0.18, startY)
        context.quadraticCurveTo(side * size * 0.28, startY + size * 0.05, endX, endY)
        context.stroke()
      }
    })

    context.beginPath()
    context.arc(-size * 0.08, -size * 0.08, Math.max(1.1, size * 0.018), 0, Math.PI * 2)
    context.arc(size * 0.08, -size * 0.08, Math.max(1.1, size * 0.018), 0, Math.PI * 2)
    context.fill()
    return
  }

  if (stamp === 'turtle') {
    context.beginPath()
    context.ellipse(0, 0, size * 0.27, size * 0.34, 0, 0, Math.PI * 2)
    context.fill()
    context.stroke()

    context.beginPath()
    context.arc(0, -size * 0.42, size * 0.08, 0, Math.PI * 2)
    context.fill()
    context.stroke()

    ;[-1, 1].forEach((side) => {
      context.beginPath()
      context.ellipse(side * size * 0.27, -size * 0.08, size * 0.1, size * 0.18, side * -0.42, 0, Math.PI * 2)
      context.fill()
      context.stroke()

      context.beginPath()
      context.ellipse(side * size * 0.24, size * 0.22, size * 0.08, size * 0.14, side * 0.44, 0, Math.PI * 2)
      context.fill()
      context.stroke()
    })

    context.beginPath()
    context.moveTo(0, size * 0.34)
    context.lineTo(-size * 0.05, size * 0.44)
    context.lineTo(size * 0.05, size * 0.44)
    context.closePath()
    context.fill()
    context.stroke()

    for (let rib = -1; rib <= 1; rib += 1) {
      context.beginPath()
      context.moveTo(rib * size * 0.08, -size * 0.22)
      context.quadraticCurveTo(rib * size * 0.12, 0, rib * size * 0.06, size * 0.24)
      context.stroke()
    }
    return
  }

  context.beginPath()
  context.ellipse(-size * 0.08, size * 0.08, size * 0.34, size * 0.16, 0.08, 0, Math.PI * 2)
  context.fill()
  context.stroke()

  context.beginPath()
  context.arc(-size * 0.2, -size * 0.16, size * 0.18, 0, Math.PI * 2)
  context.fill()
  context.stroke()

  context.beginPath()
  context.moveTo(-size * 0.42, -size * 0.2)
  context.quadraticCurveTo(-size * 0.62, -size * 0.26, -size * 0.64, -size * 0.1)
  context.stroke()

  ;[-1, 1].forEach((side) => {
    context.beginPath()
    context.moveTo(size * 0.12, -size * 0.03)
    context.quadraticCurveTo(size * 0.34, side * size * 0.04, size * 0.44, side * size * 0.1)
    context.stroke()
  })

  for (let ring = 0; ring < 3; ring += 1) {
    context.globalAlpha *= 0.82
    context.beginPath()
    context.arc(-size * 0.2, -size * 0.16, size * (0.05 + ring * 0.04), 0.4, Math.PI * 1.9)
    context.stroke()
  }
}

function drawSandStamp(
  paintCanvas: HTMLCanvasElement | null,
  shimmerCanvas: HTMLCanvasElement | null,
  brush: StudioBrush,
  point: StudioPoint,
  force = 1,
) {
  if (!paintCanvas) {
    return
  }

  const context = paintCanvas.getContext('2d')

  if (!context) {
    return
  }

  const pressure = Math.max(force, 0.45)
  const size = brush.size * (0.94 + pressure * 0.08)
  const rotation = Math.sin(point.x * 0.015 + point.y * 0.011) * 0.34

  context.save()
  context.translate(point.x, point.y)
  context.rotate(rotation)
  context.globalCompositeOperation = 'source-over'

  context.save()
  context.translate(2.2, 3.2)
  context.filter = 'blur(0.9px)'
  context.globalAlpha = 0.24
  drawCreatureStampShape(context, brush.stamp, size, {
    fillStyle: 'rgba(84, 58, 34, 0.36)',
    lineWidth: Math.max(1.2, size * 0.032),
    strokeStyle: 'rgba(84, 58, 34, 0.28)',
  })
  context.restore()

  context.save()
  context.translate(-1.6, -2.1)
  context.globalAlpha = 0.4
  drawCreatureStampShape(context, brush.stamp, size, {
    fillStyle: 'rgba(255, 249, 234, 0.32)',
    lineWidth: Math.max(1, size * 0.025),
    strokeStyle: 'rgba(255, 249, 234, 0.76)',
  })
  context.restore()

  context.globalAlpha = 0.18
  drawCreatureStampShape(context, brush.stamp, size, {
    fillStyle: 'rgba(118, 82, 45, 0.12)',
    lineWidth: Math.max(0.9, size * 0.018),
    strokeStyle: 'rgba(86, 61, 36, 0.32)',
  })

  for (let index = 0; index < 4; index += 1) {
    const angle = index * 1.9 + point.x * 0.01
    const distance = size * (0.35 + (index % 2) * 0.18)
    context.globalAlpha = 0.14
    context.fillStyle = index % 2 === 0 ? 'rgba(255, 249, 234, 0.82)' : 'rgba(126, 88, 50, 0.28)'
    context.beginPath()
    context.arc(Math.cos(angle) * distance, Math.sin(angle) * distance * 0.7, 1.2 + (index % 2), 0, Math.PI * 2)
    context.fill()
  }

  context.restore()
  drawSandLift(shimmerCanvas, point, brush, 0.28)
}

function drawSandLetter(
  paintCanvas: HTMLCanvasElement | null,
  shimmerCanvas: HTMLCanvasElement | null,
  text: string,
  point: StudioPoint,
) {
  if (!paintCanvas) {
    return { height: studioTextLineHeight, width: studioTextSize * 0.55 }
  }

  const context = paintCanvas.getContext('2d')

  if (!context) {
    return { height: studioTextLineHeight, width: studioTextSize * 0.55 }
  }

  const fontStack = '"Arial Rounded MT Bold", "Trebuchet MS", -apple-system, BlinkMacSystemFont, sans-serif'

  context.save()
  context.font = `700 ${studioTextSize}px ${fontStack}`
  context.textBaseline = 'top'
  context.lineJoin = 'round'
  const metrics = context.measureText(text)
  const width = Math.max(metrics.width, studioTextSize * 0.38)
  const height = studioTextLineHeight

  context.globalCompositeOperation = 'source-over'
  context.globalAlpha = 0.28
  context.lineWidth = 8
  context.strokeStyle = 'rgba(111, 78, 44, 0.28)'
  context.strokeText(text, point.x + 2, point.y + 4)

  context.globalAlpha = 0.78
  context.fillStyle = 'rgba(123, 88, 50, 0.3)'
  context.fillText(text, point.x + 1, point.y + 2)

  context.globalAlpha = 0.86
  context.lineWidth = 2
  context.strokeStyle = 'rgba(255, 249, 234, 0.82)'
  context.strokeText(text, point.x - 1, point.y - 1)

  context.globalAlpha = 0.42
  context.fillStyle = 'rgba(255, 249, 234, 0.38)'
  context.fillText(text, point.x - 1, point.y - 2)
  context.restore()

  if (shimmerCanvas) {
    drawSandLift(shimmerCanvas, point, studioBrushes[0], 0)
    fadeSandLift(shimmerCanvas)
  }

  return { height, width }
}

function smoothStudioRect(
  canvas: HTMLCanvasElement | null,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (!canvas) {
    return
  }

  const context = canvas.getContext('2d')

  if (!context) {
    return
  }

  context.save()
  context.filter = 'blur(2px)'
  context.fillStyle = 'rgba(240, 217, 173, 0.82)'
  context.fillRect(x - 8, y - 8, width + 16, height + 16)
  context.filter = 'none'
  context.globalAlpha = 0.22
  context.fillStyle = 'rgba(255, 249, 234, 0.54)'
  context.fillRect(x - 5, y - 4, width + 10, height + 8)
  context.restore()
}

function clampStudioValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function studioActorMaxY(bounds: StudioBounds) {
  return Math.max(studioActorPadding, bounds.height - studioActorBottomPadding)
}

function studioPointInBounds(bounds: StudioBounds, x: number, y: number): StudioPoint {
  return {
    time: performance.now(),
    x: clampStudioValue(x, studioActorPadding, Math.max(studioActorPadding, bounds.width - studioActorPadding)),
    y: clampStudioValue(y, studioActorPadding, studioActorMaxY(bounds)),
  }
}

function makeStudioTarget(bounds: StudioBounds, index: number, seed = performance.now()) {
  const orbit = index * 1.84 + seed * 0.00042
  const drift = Math.sin(seed * 0.00031 + index) * 0.18

  return studioPointInBounds(
    bounds,
    bounds.width * (0.5 + Math.cos(orbit) * (0.22 + drift)),
    bounds.height * (0.52 + Math.sin(orbit * 0.74) * 0.24),
  )
}

function createStudioActors(bounds: StudioBounds, now = performance.now()): StudioCreatureActor[] {
  return studioBrushes.map((brush, index) => {
    const start = studioPointInBounds(
      bounds,
      bounds.width * (0.22 + index * 0.25),
      bounds.height * (0.46 + Math.sin(index * 1.6) * 0.18),
    )
    const target = makeStudioTarget(bounds, index, now + index * 1100)
    const speed = brush.stamp === 'crab' ? 58 : brush.stamp === 'turtle' ? 34 : 26

    return {
      brush,
      direction: 0,
      facing: 1,
      id: brush.id,
      lastTrailAt: now - index * 120,
      nextWanderAt: now + 1800 + index * 650,
      phase: index * 1.27,
      speed,
      step: 0,
      targetX: target.x,
      targetY: target.y,
      vx: 0,
      vy: 0,
      x: start.x,
      y: start.y,
    }
  })
}

function drawStudioShellSignal(
  paintCanvas: HTMLCanvasElement | null,
  shimmerCanvas: HTMLCanvasElement | null,
  point: StudioPoint,
) {
  if (!paintCanvas) {
    return
  }

  const context = paintCanvas.getContext('2d')

  if (!context) {
    return
  }

  context.save()
  context.translate(point.x, point.y)
  context.rotate(Math.sin(point.x * 0.014) * 0.24)
  context.globalCompositeOperation = 'source-over'

  context.globalAlpha = 0.28
  context.fillStyle = 'rgba(110, 78, 45, 0.2)'
  context.beginPath()
  context.ellipse(3, 5, 18, 8, -0.12, 0, Math.PI * 2)
  context.fill()

  context.globalAlpha = 0.66
  context.fillStyle = 'rgba(255, 248, 226, 0.58)'
  context.strokeStyle = 'rgba(114, 83, 51, 0.2)'
  context.lineWidth = 1.4
  context.beginPath()
  context.moveTo(-15, 6)
  context.quadraticCurveTo(-10, -15, 0, -17)
  context.quadraticCurveTo(12, -14, 16, 6)
  context.quadraticCurveTo(4, 11, -15, 6)
  context.closePath()
  context.fill()
  context.stroke()

  for (let rib = -2; rib <= 2; rib += 1) {
    context.globalAlpha = 0.38
    context.beginPath()
    context.moveTo(0, -13)
    context.quadraticCurveTo(rib * 4.4, -4, rib * 6.8, 7)
    context.stroke()
  }

  context.restore()
  drawSandLift(shimmerCanvas, point, studioBrushes[0], 0.18)
}

function drawCreatureTrail(
  paintCanvas: HTMLCanvasElement | null,
  shimmerCanvas: HTMLCanvasElement | null,
  actor: StudioCreatureActor,
  velocity: number,
) {
  if (!paintCanvas) {
    return
  }

  const context = paintCanvas.getContext('2d')

  if (!context) {
    return
  }

  const size = actor.brush.size
  const side = Math.floor(actor.step) % 2 === 0 ? -1 : 1

  context.save()
  context.translate(actor.x, actor.y)
  context.rotate(actor.direction)
  context.globalCompositeOperation = 'source-over'
  context.lineCap = 'round'
  context.lineJoin = 'round'

  if (actor.brush.stamp === 'crab') {
    context.strokeStyle = 'rgba(83, 58, 34, 0.22)'
    context.lineWidth = 1.5

    for (let leg = 0; leg < 3; leg += 1) {
      const back = -size * (0.16 + leg * 0.08)
      const reach = size * (0.21 + leg * 0.04)

      context.globalAlpha = 0.42 - leg * 0.06
      context.beginPath()
      context.moveTo(back, side * size * 0.2)
      context.quadraticCurveTo(back - size * 0.08, side * reach, back - size * 0.18, side * (reach + 6))
      context.stroke()
    }

    context.globalAlpha = 0.28
    context.fillStyle = 'rgba(255, 249, 234, 0.62)'
    context.beginPath()
    context.arc(-size * 0.3, side * size * 0.18, 2.4, 0, Math.PI * 2)
    context.fill()
  } else if (actor.brush.stamp === 'turtle') {
    context.strokeStyle = 'rgba(95, 67, 40, 0.2)'
    context.fillStyle = 'rgba(255, 249, 234, 0.46)'
    context.lineWidth = 1.3
    context.globalAlpha = 0.46

    ;[-1, 1].forEach((flipperSide) => {
      context.beginPath()
      context.ellipse(-size * 0.22, flipperSide * side * size * 0.28, 6.5, 2.6, flipperSide * 0.56, 0, Math.PI * 2)
      context.fill()
      context.stroke()
    })

    context.globalAlpha = 0.18
    context.beginPath()
    context.moveTo(-size * 0.38, 0)
    context.quadraticCurveTo(-size * 0.18, side * 2.4, size * 0.04, 0)
    context.stroke()
  } else {
    context.strokeStyle = 'rgba(102, 76, 47, 0.16)'
    context.lineWidth = 5.4
    context.globalAlpha = 0.18
    context.beginPath()
    context.moveTo(-size * 0.44, side * size * 0.03)
    context.quadraticCurveTo(-size * 0.22, side * size * 0.11, size * 0.08, side * size * 0.04)
    context.stroke()

    context.strokeStyle = 'rgba(255, 249, 234, 0.38)'
    context.lineWidth = 2.4
    context.globalAlpha = 0.42
    context.beginPath()
    context.moveTo(-size * 0.42, side * size * 0.03)
    context.quadraticCurveTo(-size * 0.18, side * size * 0.08, size * 0.08, side * size * 0.02)
    context.stroke()

    context.globalAlpha = 0.2
    context.fillStyle = 'rgba(255, 249, 234, 0.54)'
    context.beginPath()
    context.ellipse(size * 0.04, side * size * 0.02, 3.6, 1.8, 0.1, 0, Math.PI * 2)
    context.fill()
  }

  context.restore()
  drawSandLift(
    shimmerCanvas,
    {
      time: performance.now(),
      x: actor.x,
      y: actor.y,
    },
    actor.brush,
    velocity,
  )
}

function SplashStudio({ reducedMotion }: { reducedMotion: boolean }) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPaused, setIsPaused] = useState(reducedMotion)
  const [studioVoice, setStudioVoice] = useState('The sea turtle is exploring the shore.')
  const [attractor, setAttractor] = useState<StudioAttractor | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const shimmerCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const canvasBoundsRef = useRef<StudioBounds | null>(null)
  const frameRef = useRef<number | null>(null)
  const actorNodesRef = useRef<Record<string, HTMLDivElement | null>>({})
  const actorsRef = useRef<StudioCreatureActor[]>([])
  const attractorRef = useRef<StudioAttractor | null>(null)
  const isPausedRef = useRef(isPaused)
  const isStudioVisibleRef = useRef(true)
  const lastFrameAtRef = useRef(0)
  const lastShimmerFadeAtRef = useRef(0)
  const studioSectionRef = useRef<HTMLElement | null>(null)
  const textCursorRef = useRef<StudioPoint | null>(null)
  const textStampsRef = useRef<TextStamp[]>([])

  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  useEffect(() => {
    attractorRef.current = attractor
  }, [attractor])

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
      window.setTimeout(refreshCanvasBounds, 80)
    }

    document.addEventListener('fullscreenchange', syncFullscreenState)

    return () => document.removeEventListener('fullscreenchange', syncFullscreenState)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const shimmerCanvas = shimmerCanvasRef.current
    let resizeFrame: number | null = null
    let previousHeight = 0
    let previousWidth = 0

    const handleResize = () => {
      if (resizeFrame !== null) {
        window.cancelAnimationFrame(resizeFrame)
      }

      resizeFrame = window.requestAnimationFrame(() => {
        const bounds = refreshCanvasBounds()

        if (!bounds) {
          return
        }

        const materiallyResized = Math.abs(bounds.width - previousWidth) > 2 || Math.abs(bounds.height - previousHeight) > 2

        if (!materiallyResized) {
          return
        }

        previousHeight = bounds.height
        previousWidth = bounds.width
        clearStudioSurface(canvas, shimmerCanvas)
        actorsRef.current = createStudioActors(bounds)
        textCursorRef.current = null
      })
    }

    clearStudioSurface(canvas, shimmerCanvas)
    const bounds = refreshCanvasBounds()

    if (bounds) {
      previousHeight = bounds.height
      previousWidth = bounds.width
      actorsRef.current = createStudioActors(bounds)
    }

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(handleResize)

    if (canvas && resizeObserver) {
      resizeObserver.observe(canvas)
    } else {
      window.addEventListener('resize', handleResize)
    }

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', handleResize)

      if (resizeFrame !== null) {
        window.cancelAnimationFrame(resizeFrame)
      }
    }
  }, [])

  useEffect(() => {
    const section = studioSectionRef.current

    if (!section || typeof IntersectionObserver === 'undefined') {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = Boolean(entry?.isIntersecting)
        isStudioVisibleRef.current = isVisible

        if (isVisible) {
          lastFrameAtRef.current = performance.now()
        }
      },
      { rootMargin: '160px 0px' },
    )

    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isPausedRef.current = true
        setIsPaused(true)
      }
    }

    const animateStudio = (now: number) => {
      if (!isStudioVisibleRef.current) {
        lastFrameAtRef.current = now
        frameRef.current = window.requestAnimationFrame(animateStudio)
        return
      }

      const bounds = canvasBoundsRef.current ?? refreshCanvasBounds()

      if (!bounds) {
        frameRef.current = window.requestAnimationFrame(animateStudio)
        return
      }

      if (actorsRef.current.length === 0) {
        actorsRef.current = createStudioActors(bounds, now)
      }

      const elapsed = lastFrameAtRef.current ? now - lastFrameAtRef.current : 16
      const delta = clampStudioValue(elapsed / 1000, 0.001, 0.05)
      lastFrameAtRef.current = now

      if (!isPausedRef.current) {
        updateStudioActors(bounds, now, delta)
      }

      actorsRef.current.forEach((actor) => updateActorNode(actor, now))
      frameRef.current = window.requestAnimationFrame(animateStudio)
    }

    frameRef.current = window.requestAnimationFrame(animateStudio)
    window.addEventListener('blur', handleVisibilityChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('blur', handleVisibilityChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
    // The game loop reads mutable refs so it can stay stable without restarting on every render.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshCanvasBounds = () => {
    const canvas = canvasRef.current

    if (!canvas) {
      return null
    }

    const rect = canvas.getBoundingClientRect()
    const bounds = {
      height: rect.height,
      left: rect.left,
      top: rect.top,
      width: rect.width,
    }

    canvasBoundsRef.current = bounds
    return bounds
  }

  const defaultTextCursor = () => {
    const bounds = canvasBoundsRef.current ?? refreshCanvasBounds()

    if (!bounds) {
      return {
        time: performance.now(),
        x: 40,
        y: 120,
      }
    }

    return {
      time: performance.now(),
      x: Math.max(28, bounds.width * 0.12),
      y: Math.max(54, bounds.height * 0.22),
    }
  }

  const keepTextCursorInBounds = (point: StudioPoint) => {
    const bounds = canvasBoundsRef.current ?? refreshCanvasBounds()

    if (!bounds) {
      return point
    }

    return {
      ...point,
      x: Math.min(Math.max(24, point.x), Math.max(24, bounds.width - 48)),
      y: Math.min(Math.max(24, point.y), Math.max(24, bounds.height - studioTextLineHeight - 20)),
    }
  }

  const setCreatureNode = (id: string) => (node: HTMLDivElement | null) => {
    actorNodesRef.current[id] = node
  }

  const moveActorToWanderTarget = (actor: StudioCreatureActor, bounds: StudioBounds, now: number, index: number) => {
    const target = makeStudioTarget(bounds, index, now + Math.random() * 2200)
    actor.targetX = target.x
    actor.targetY = target.y
    actor.nextWanderAt = now + 2600 + Math.random() * 2600 + index * 320
  }

  const updateActorNode = (actor: StudioCreatureActor, now: number) => {
    const node = actorNodesRef.current[actor.id]

    if (!node) {
      return
    }

    const speed = Math.hypot(actor.vx, actor.vy)
    const size = studioCreatureDisplaySize(actor.brush)
    const bob = Math.sin(now * 0.006 + actor.phase) * (actor.brush.stamp === 'crab' ? 2.4 : actor.brush.stamp === 'turtle' ? 1.2 : 0.55)
    const crawlSquash = actor.brush.stamp === 'crab'
      ? 1 + Math.sin(actor.step * 1.7) * 0.035
      : actor.brush.stamp === 'snail'
        ? 1 + Math.sin(actor.step * 1.15) * 0.018
        : 1
    const verticalScale = 2 - crawlSquash
    const tilt = speed > 1
      ? clampStudioValue(actor.vy / Math.max(speed, 1) * 0.18, -0.18, 0.18)
      : 0

    const rotation = actor.brush.stamp === 'turtle' ? actor.direction : tilt
    const turtleBreath = actor.brush.stamp === 'turtle'
      ? 1 + Math.sin(now * 0.0034 + actor.phase) * 0.012
      : 1
    const horizontalScale = actor.brush.stamp === 'turtle'
      ? turtleBreath
      : actor.facing * crawlSquash
    const resolvedVerticalScale = actor.brush.stamp === 'turtle'
      ? 2 - turtleBreath
      : verticalScale

    node.style.transform = `translate3d(${actor.x - size / 2}px, ${actor.y - size / 2 + bob}px, 0) rotate(${rotation}rad) scale(${horizontalScale}, ${resolvedVerticalScale})`
  }

  const updateStudioActors = (bounds: StudioBounds, now: number, delta: number) => {
    const canvas = canvasRef.current
    const shimmerCanvas = shimmerCanvasRef.current
    const currentAttractor = attractorRef.current
    const isAttracted = currentAttractor && now - currentAttractor.time < studioAttractorLifetime
    const motionScale = reducedMotion ? 0.58 : 1

    if (currentAttractor && !isAttracted) {
      attractorRef.current = null
      setAttractor(null)
    }

    actorsRef.current.forEach((actor, index) => {
      if (isAttracted && currentAttractor) {
        const orbit = actor.phase * 2.1 + index
        actor.targetX = clampStudioValue(
          currentAttractor.x + Math.cos(orbit) * (18 + index * 8),
          studioActorPadding,
          Math.max(studioActorPadding, bounds.width - studioActorPadding),
        )
        actor.targetY = clampStudioValue(
          currentAttractor.y + Math.sin(orbit) * (16 + index * 7),
          studioActorPadding,
          studioActorMaxY(bounds),
        )
      } else if (now > actor.nextWanderAt) {
        moveActorToWanderTarget(actor, bounds, now, index)
      }

      const dx = actor.targetX - actor.x
      const dy = actor.targetY - actor.y
      const distance = Math.max(Math.hypot(dx, dy), 1)

      if (distance < 18 && !isAttracted) {
        moveActorToWanderTarget(actor, bounds, now, index)
      }

      const targetSpeed = actor.speed * motionScale * (isAttracted ? 1.12 : 1) * (distance < 70 ? 0.72 : 1)
      const desiredVx = (dx / distance) * targetSpeed
      const desiredVy = (dy / distance) * targetSpeed
      const follow = Math.min(1, delta * (isAttracted ? 5.8 : 3.7))

      actor.vx += (desiredVx - actor.vx) * follow
      actor.vy += (desiredVy - actor.vy) * follow
      actor.x = clampStudioValue(actor.x + actor.vx * delta, studioActorPadding, Math.max(studioActorPadding, bounds.width - studioActorPadding))
      actor.y = clampStudioValue(actor.y + actor.vy * delta, studioActorPadding, studioActorMaxY(bounds))

      const speed = Math.hypot(actor.vx, actor.vy)

      if (speed > 1) {
        actor.direction = Math.atan2(actor.vy, actor.vx)
        if (Math.abs(actor.vx) > 3) {
          actor.facing = actor.vx < 0 ? -1 : 1
        }
        actor.step += speed * delta * (actor.brush.stamp === 'crab' ? 0.12 : 0.08)
      }

      const trailDelay = actor.brush.stamp === 'crab' ? 120 : actor.brush.stamp === 'turtle' ? 230 : 170

      if (speed > 7 && now - actor.lastTrailAt > trailDelay) {
        drawCreatureTrail(canvas, shimmerCanvas, actor, speed / 70)
        actor.lastTrailAt = now
      }
    })

    if (now - lastShimmerFadeAtRef.current > 84) {
      fadeSandLift(shimmerCanvas)
      lastShimmerFadeAtRef.current = now
    }
  }

  const dropAttractor = (point: StudioPoint) => {
    const bounds = canvasBoundsRef.current ?? refreshCanvasBounds()

    if (!bounds) {
      return
    }

    const now = performance.now()
    const safePoint = studioPointInBounds(bounds, point.x, point.y)
    const nextAttractor = {
      id: now,
      time: now,
      x: safePoint.x,
      y: safePoint.y,
    }

    attractorRef.current = nextAttractor
    setAttractor(nextAttractor)
    drawStudioShellSignal(canvasRef.current, shimmerCanvasRef.current, safePoint)

    actorsRef.current.forEach((actor, index) => {
      const angle = index * 2.15 + 0.8
      actor.targetX = clampStudioValue(
        safePoint.x + Math.cos(angle) * (24 + index * 8),
        studioActorPadding,
        Math.max(studioActorPadding, bounds.width - studioActorPadding),
      )
      actor.targetY = clampStudioValue(
        safePoint.y + Math.sin(angle) * (18 + index * 6),
        studioActorPadding,
        studioActorMaxY(bounds),
      )
      actor.nextWanderAt = now + studioAttractorLifetime
    })

    if (isPaused) {
      setIsPaused(false)
    }

    setStudioVoice('A shell! The turtle is on the way.')
  }

  const handleSandPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    event.currentTarget.focus()

    const bounds = canvasBoundsRef.current ?? refreshCanvasBounds()

    if (!bounds) {
      return
    }

    dropAttractor(canvasPointFromClient(bounds, event.clientX, event.clientY, performance.now()))
  }

  const scatterCreatures = () => {
    const bounds = canvasBoundsRef.current ?? refreshCanvasBounds()

    if (!bounds) {
      return
    }

    const now = performance.now()
    attractorRef.current = null
    setAttractor(null)
    actorsRef.current.forEach((actor, index) => {
      moveActorToWanderTarget(actor, bounds, now + index * 500, index)
      drawSandStamp(canvasRef.current, shimmerCanvasRef.current, actor.brush, {
        time: now,
        x: actor.x,
        y: actor.y,
      }, reducedMotion ? 0.5 : 0.74)
    })
    fadeSandLift(shimmerCanvasRef.current)
    setStudioVoice('A new turtle trail.')
  }

  const clearStudio = () => {
    const bounds = canvasBoundsRef.current ?? refreshCanvasBounds()

    textCursorRef.current = null
    textStampsRef.current = []
    attractorRef.current = null
    setAttractor(null)
    clearStudioSurface(canvasRef.current, shimmerCanvasRef.current)

    if (bounds) {
      actorsRef.current = createStudioActors(bounds)
    }

    setStudioVoice('Fresh sand.')
  }

  const togglePause = () => {
    setIsPaused((current) => {
      const next = !current
      isPausedRef.current = next
      lastFrameAtRef.current = performance.now()
      setStudioVoice(next ? 'Turtle nap time.' : 'Off the turtle goes.')
      return next
    })
  }

  const toggleFullscreen = async () => {
    const section = studioSectionRef.current

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else if (section?.requestFullscreen) {
        await section.requestFullscreen()
      } else {
        setIsFullscreen((current) => !current)
      }
    } catch {
      setIsFullscreen((current) => !current)
    } finally {
      window.setTimeout(refreshCanvasBounds, 120)
    }
  }

  const handleStudioKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return
    }

    const canvas = canvasRef.current
    const bounds = canvasBoundsRef.current ?? refreshCanvasBounds()

    if (!canvas || !bounds) {
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setIsPaused(true)
      setStudioVoice('Turtle nap time.')
      return
    }

    if (event.key === 'Backspace') {
      event.preventDefault()
      const lastStamp = textStampsRef.current.pop()

      if (lastStamp) {
        smoothStudioRect(canvas, lastStamp.x, lastStamp.y, lastStamp.width, lastStamp.height)
        textCursorRef.current = keepTextCursorInBounds({
          time: performance.now(),
          x: lastStamp.x,
          y: lastStamp.y,
        })
      }
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      scatterCreatures()
      return
    }

    if (event.key.startsWith('Arrow')) {
      event.preventDefault()
      const cursor = keepTextCursorInBounds(textCursorRef.current ?? defaultTextCursor())
      const move = event.shiftKey ? 44 : 20
      textCursorRef.current = keepTextCursorInBounds({
        time: performance.now(),
        x: cursor.x + (event.key === 'ArrowRight' ? move : event.key === 'ArrowLeft' ? -move : 0),
        y: cursor.y + (event.key === 'ArrowDown' ? move : event.key === 'ArrowUp' ? -move : 0),
      })
      return
    }

    if (event.key.length !== 1) {
      return
    }

    event.preventDefault()
    let cursor = keepTextCursorInBounds(textCursorRef.current ?? defaultTextCursor())

    if (cursor.x > bounds.width - 60) {
      cursor = {
        time: performance.now(),
        x: Math.max(28, bounds.width * 0.12),
        y: cursor.y + studioTextLineHeight,
      }
    }

    const stamp = drawSandLetter(canvas, shimmerCanvasRef.current, event.key, cursor)
    textStampsRef.current.push({
      ...stamp,
      text: event.key,
      x: cursor.x,
      y: cursor.y,
    })
    textCursorRef.current = keepTextCursorInBounds({
      time: performance.now(),
      x: cursor.x + stamp.width + (event.key === ' ' ? studioTextSize * 0.18 : 4),
      y: cursor.y,
    })
    dropAttractor({
      time: performance.now(),
      x: cursor.x + stamp.width / 2,
      y: cursor.y + studioTextSize * 0.44,
    })
    setStudioVoice('Letters in the sand.')
  }

  return (
    <section
      className={`studio-section studio-game-section ${isFullscreen ? 'is-studio-fullscreen' : ''}`}
      data-no-splash
      aria-labelledby="studio-title"
      ref={studioSectionRef}
    >
      <div className="studio-intro">
        <div>
          <p className="eyebrow">
            <Waves size={16} />
            Tiny tide club
          </p>
          <h2 aria-label="Come play in the sand." id="studio-title">
            <KineticText lines={['Come play in', 'the sand.']} />
          </h2>
        </div>
      </div>

      <div className="studio-layout">
        <div className="studio-canvas-shell">
          <div className="studio-sandbar">
            <canvas
              aria-label="Self-playing sand game. A sea turtle wanders across the beach; tap or type to change its path."
              className="splash-canvas"
              onKeyDown={handleStudioKeyDown}
              onPointerDown={handleSandPointerDown}
              ref={canvasRef}
              tabIndex={0}
            />
            <canvas aria-hidden="true" className="splash-shimmer-canvas" ref={shimmerCanvasRef} />
            {attractor ? (
              <span
                aria-hidden="true"
                className="studio-attractor"
                style={
                  {
                    '--attractor-x': `${attractor.x}px`,
                    '--attractor-y': `${attractor.y}px`,
                  } as CSSProperties
                }
              />
            ) : null}
            <div aria-hidden="true" className="studio-creatures">
              {studioBrushes.map((brush) => (
                <div
                  className={`studio-creature studio-creature-${brush.stamp}`}
                  key={brush.id}
                  ref={setCreatureNode(brush.id)}
                  style={
                    {
                      '--studio-creature-glow': brush.creatureGlow,
                      '--studio-creature-size': `${studioCreatureDisplaySize(brush)}px`,
                    } as CSSProperties
                  }
                >
                  <img alt="" decoding="async" loading="lazy" src={brush.creatureImage} />
                </div>
              ))}
            </div>
            <div className="studio-panel">
              <p aria-live="polite" className="studio-voice">
                {studioVoice}
              </p>
              <div className="studio-actions">
                <button
                  aria-pressed={!isPaused}
                  className="icon-button studio-tool-button"
                  onClick={togglePause}
                  title={isPaused ? 'Play' : 'Pause'}
                  type="button"
                >
                  {isPaused ? <Play size={18} /> : <Pause size={18} />}
                </button>
                <button
                  className="icon-button studio-tool-button"
                  onClick={scatterCreatures}
                  title="New paths"
                  type="button"
                >
                  <Sparkles size={18} />
                </button>
                <button
                  className="icon-button studio-tool-button"
                  onClick={() => void toggleFullscreen()}
                  title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                  type="button"
                >
                  {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button
                  className="icon-button studio-tool-button"
                  onClick={clearStudio}
                  title="Smooth sand"
                  type="button"
                >
                  <RotateCcw size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function DeferredStudio({ reducedMotion }: { reducedMotion: boolean }) {
  const [shouldMount, setShouldMount] = useState(
    () => typeof window !== 'undefined' && window.location.hash === '#studio',
  )
  const placeholderRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (shouldMount) {
      return
    }

    const placeholder = placeholderRef.current

    if (!placeholder || !('IntersectionObserver' in window)) {
      setShouldMount(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldMount(true)
          observer.disconnect()
        }
      },
      { rootMargin: '900px 0px' },
    )

    observer.observe(placeholder)

    return () => observer.disconnect()
  }, [shouldMount])

  return (
    <div
      className={`studio-deferred ${shouldMount ? 'is-mounted' : ''}`}
      id="studio"
      ref={placeholderRef}
    >
      {shouldMount ? <SplashStudio reducedMotion={reducedMotion} /> : null}
    </div>
  )
}

function DropFilmsSection({
  films,
  products,
  status,
}: {
  films: DropFilm[]
  products: Product[]
  status: 'idle' | 'loading' | 'ready' | 'error'
}) {
  const [activeFilmIndex, setActiveFilmIndex] = useState(0)
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
  const carouselRef = useRef<HTMLDivElement | null>(null)
  const dragStartXRef = useRef<number | null>(null)
  const dragDeltaXRef = useRef(0)
  const dragFrameRef = useRef<number | null>(null)
  const suppressCardClickRef = useRef(false)
  const hasUploadedFilms = films.some((film) => film.source === 'uploaded')
  const filmStorySummaries = [
    'A tiny texture study in sea-glass gel.',
    'Watch the slow rise return like a tide.',
    'Pearl beads, soft pops, and a little shine.',
    'A coastal edit for gifting in small waves.',
    'A quick look at the freebie-sized squeeze.',
  ]

  useEffect(() => {
    setActiveFilmIndex((current) => films.length === 0 ? 0 : Math.min(current, films.length - 1))
    setActiveVideoId(null)
  }, [films.length])

  useEffect(() => {
    return () => {
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current)
      }
    }
  }, [])

  const moveCarousel = (direction: 'back' | 'forward') => {
    if (films.length < 2) {
      return
    }

    setActiveVideoId(null)
    setActiveFilmIndex((current) => (
      direction === 'forward'
        ? (current + 1) % films.length
        : (current - 1 + films.length) % films.length
    ))
  }

  const relativeFilmIndex = (index: number) => {
    if (films.length < 2) {
      return 0
    }

    let offset = (index - activeFilmIndex + films.length) % films.length

    if (offset > films.length / 2) {
      offset -= films.length
    }

    return offset
  }

  const visibleFilms = films
    .map((film, index) => ({ film, index, relativeIndex: relativeFilmIndex(index) }))
    .filter(({ relativeIndex }) => Math.abs(relativeIndex) <= 2)

  const applyCarouselDrag = (deltaX: number, dragging: boolean) => {
    const carousel = carouselRef.current

    if (!carousel) {
      return
    }

    carousel.style.setProperty('--film-drag-x', `${deltaX}px`)

    if (dragging) {
      carousel.dataset.dragging = 'true'
    } else {
      delete carousel.dataset.dragging
    }
  }

  const resetCarouselDrag = () => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current)
      dragFrameRef.current = null
    }

    dragDeltaXRef.current = 0
    applyCarouselDrag(0, false)
  }

  const handleFilmCarouselKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return
    }

    event.preventDefault()
    moveCarousel(event.key === 'ArrowRight' ? 'forward' : 'back')
  }

  const handleFilmCarouselPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    const target = event.target as HTMLElement

    if (target.closest('video, button, a, input')) {
      return
    }

    dragStartXRef.current = event.clientX
    dragDeltaXRef.current = 0
    suppressCardClickRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
    applyCarouselDrag(0, true)
  }

  const handleFilmCarouselPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const startX = dragStartXRef.current

    if (startX === null) {
      return
    }

    const maxDrag = Math.min(140, event.currentTarget.clientWidth * 0.28)
    const deltaX = Math.max(-maxDrag, Math.min(maxDrag, event.clientX - startX))
    dragDeltaXRef.current = deltaX

    if (Math.abs(deltaX) > 7) {
      suppressCardClickRef.current = true
    }

    if (dragFrameRef.current !== null) {
      return
    }

    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = null
      applyCarouselDrag(dragDeltaXRef.current, true)
    })
  }

  const finishFilmCarouselPointer = (
    event: PointerEvent<HTMLDivElement>,
    cancelled = false,
  ) => {
    const startX = dragStartXRef.current
    dragStartXRef.current = null

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (startX === null) {
      resetCarouselDrag()
      return
    }

    const deltaX = dragDeltaXRef.current || event.clientX - startX
    resetCarouselDrag()

    if (suppressCardClickRef.current) {
      window.setTimeout(() => {
        suppressCardClickRef.current = false
      }, 0)
    }

    if (cancelled || Math.abs(deltaX) < 44) {
      return
    }

    moveCarousel(deltaX < 0 ? 'forward' : 'back')
  }

  return (
    <section className="films-section" id="films" aria-labelledby="films-title">
      <div className="film-carousel-heading">
        <h2 aria-label="More stories for you." id="films-title">
          <KineticText lines={['More stories', 'for you.']} />
        </h2>
        <p aria-live="polite" className="sr-only">
          {status === 'loading'
            ? 'Loading drop films.'
            : films[activeFilmIndex]
              ? `${hasUploadedFilms ? 'Live' : 'Preview'} story ${activeFilmIndex + 1} of ${films.length}: ${films[activeFilmIndex].title}.`
              : 'No drop films are available.'}
        </p>
      </div>
      <div
        aria-label="Drop film stories. Use arrow keys or swipe to navigate."
        className="film-carousel"
        data-no-splash
        onKeyDown={handleFilmCarouselKeyDown}
        onPointerCancel={(event) => finishFilmCarouselPointer(event, true)}
        onPointerDown={handleFilmCarouselPointerDown}
        onPointerMove={handleFilmCarouselPointerMove}
        onPointerUp={finishFilmCarouselPointer}
        ref={carouselRef}
        role="region"
        tabIndex={0}
      >
        {visibleFilms.map(({ film, index, relativeIndex }) => {
          const filmProduct = products[index % products.length] ?? catalogProducts[0]
          const filmDepth = Math.abs(relativeIndex)
          const isActive = relativeIndex === 0
          const isVideoActive = Boolean(film.url && isActive && activeVideoId === film.id)
          const storySummary = film.source === 'uploaded'
            ? 'Fresh from the latest drop, ready to preview.'
            : filmStorySummaries[index % filmStorySummaries.length]
          const filmPositionStyle = {
            '--film-opacity': filmDepth === 2 ? 0.74 : 1,
            '--film-rotation': `${relativeIndex * 6}deg`,
            '--film-scale': 1 - filmDepth * 0.045,
            '--film-x': `${relativeIndex * 66}%`,
            '--film-x-mobile': `${relativeIndex * 6}%`,
            '--film-x-tablet': `${relativeIndex * 28}%`,
            '--film-y': `${filmDepth === 0 ? 0 : filmDepth === 1 ? 30 : 88}px`,
            zIndex: 10 - filmDepth,
          } as CSSProperties

          return (
            <article
              aria-hidden={!isActive}
              aria-label={`Film ${index + 1} of ${films.length}: ${film.title}`}
              className="film-story-card"
              data-film-active={isActive}
              data-film-offset={relativeIndex}
              id={`film-story-${slugify(film.id)}`}
              key={film.id}
              onClick={() => {
                if (suppressCardClickRef.current) {
                  suppressCardClickRef.current = false
                  return
                }

                if (!isActive && Math.abs(relativeIndex) <= 2) {
                  setActiveVideoId(null)
                  setActiveFilmIndex(index)
                } else if (isActive && film.url) {
                  setActiveVideoId(film.id)
                }
              }}
              style={filmPositionStyle}
            >
              <div
                className="film-card-media"
                onMouseEnter={() => {
                  if (isActive && film.url) {
                    setActiveVideoId(film.id)
                  }
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.querySelector('video')?.pause()
                }}
              >
                <div
                  aria-hidden={isVideoActive}
                  aria-label={isVideoActive ? undefined : film.title}
                  className="film-thumb"
                  role={isVideoActive ? undefined : 'img'}
                >
                  <ProductVisual className="film-thumb-visual" product={filmProduct} />
                  {film.url && isActive && !isVideoActive ? (
                    <button
                      aria-label={`Play ${film.title}`}
                      className="film-play-badge"
                      onClick={(event) => {
                        event.stopPropagation()
                        setActiveVideoId(film.id)
                      }}
                      type="button"
                    >
                      <Play size={20} />
                    </button>
                  ) : !film.url || !isActive ? (
                    <span className="film-play-badge">
                      <Play size={20} />
                    </span>
                  ) : null}
                </div>
                {isVideoActive ? (
                  <video
                    aria-label={film.title}
                    autoPlay
                    controls
                    loop
                    muted
                    playsInline
                    preload="none"
                    src={film.url}
                    tabIndex={0}
                  />
                ) : null}
              </div>
              <div className="film-card-copy">
                <h3 className="film-card-title">{film.title}</h3>
                <p className="film-card-summary">{storySummary}</p>
                <span className="film-card-meta">
                  Watch {film.durationSeconds ? `${Math.round(film.durationSeconds)} sec` : '30 sec'}
                  <ArrowRight aria-hidden="true" size={13} />
                </span>
              </div>
            </article>
          )
        })}
      </div>
      <div aria-label="Drop film carousel navigation" className="film-carousel-controls" data-no-splash role="group">
        <button
          aria-label="Previous film story"
          className="film-carousel-button"
          disabled={films.length < 2}
          onClick={() => moveCarousel('back')}
          type="button"
        >
          <ArrowLeft size={22} />
        </button>
        <span aria-hidden="true" className="film-carousel-position">
          <strong>{String(activeFilmIndex + 1).padStart(2, '0')}</strong>
          <span>/</span>
          {String(films.length).padStart(2, '0')}
        </span>
        <button
          aria-label="Next film story"
          className="film-carousel-button"
          disabled={films.length < 2}
          onClick={() => moveCarousel('forward')}
          type="button"
        >
          <ArrowRight size={22} />
        </button>
      </div>
    </section>
  )
}

function DropFilmAdmin({
  films,
  onFilmsRefresh,
  onProductCategoriesChanged,
  onProductCommerceChanged,
  onProductDeleted,
  onProductMediaDeleted,
  onProductMediaReconciled,
  onProductMediaRefresh,
  onProductRenamed,
  products,
  productMediaByProduct,
}: {
  films: DropFilm[]
  onFilmsRefresh: () => Promise<void>
  onProductCategoriesChanged: (productId: string, categories: ProductCategory[]) => void
  onProductCommerceChanged: (productId: string, price: number, inventoryQuantity: number) => void
  onProductDeleted: (productId: string) => void
  onProductMediaDeleted: (productId: string, assetPathname: string) => void
  onProductMediaReconciled: (
    removed: Array<{ pathname: string; productId: string }>,
  ) => void
  onProductMediaRefresh: () => Promise<void>
  onProductRenamed: (productId: string, name: string) => void
  products: Product[]
  productMediaByProduct: ProductMediaByProduct
}) {
  const [adminPassword, setAdminPassword] = useState(() => {
    try {
      return window.sessionStorage.getItem('saltwater-drop-film-password') ?? ''
    } catch {
      return ''
    }
  })
  const [isAuthorized, setIsAuthorized] = useState(() => {
    try {
      return window.sessionStorage.getItem('saltwater-drop-film-authorized') === 'true'
    } catch {
      return false
    }
  })
  const [title, setTitle] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [pendingProductMediaFiles, setPendingProductMediaFiles] = useState<PendingProductMediaFile[]>([])
  const [videoDuration, setVideoDuration] = useState<number | undefined>()
  const [uploadProgress, setUploadProgress] = useState(0)
  const [productMediaUploadProgress, setProductMediaUploadProgress] = useState(0)
  const [adminMessage, setAdminMessage] = useState('')
  const [adminError, setAdminError] = useState('')
  const [isCheckingLogin, setIsCheckingLogin] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isUploadingProductMedia, setIsUploadingProductMedia] = useState(false)
  const [editingProductId, setEditingProductId] = useState('')
  const [editingProductName, setEditingProductName] = useState('')
  const [savingProductId, setSavingProductId] = useState('')
  const [deletingProductId, setDeletingProductId] = useState('')
  const [deletingMediaKey, setDeletingMediaKey] = useState('')
  const [missingMediaKeys, setMissingMediaKeys] = useState<Set<string>>(() => new Set())
  const [isCheckingMissingMedia, setIsCheckingMissingMedia] = useState(false)
  const [isPruningMissingMedia, setIsPruningMissingMedia] = useState(false)
  const [taggingProductId, setTaggingProductId] = useState('')
  const [editingCommerceProductId, setEditingCommerceProductId] = useState('')
  const [editingPrice, setEditingPrice] = useState('')
  const [editingQuantity, setEditingQuantity] = useState('')
  const [savingCommerceProductId, setSavingCommerceProductId] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const productMediaInputRef = useRef<HTMLInputElement | null>(null)
  const uploadedFilms = films.filter((film) => film.source === 'uploaded')
  const pendingProductGroups = products
    .map((product) => ({
      files: pendingProductMediaFiles.filter((item) => item.productId === product.id),
      product,
    }))
    .filter((group) => group.files.length > 0)
  const unassignedProductMediaFiles = pendingProductMediaFiles.filter((item) => !item.productId)
  const uploadedProductMediaCount = products.reduce(
    (total, product) => total + (productMediaByProduct[product.id]?.length ?? 0),
    0,
  )
  const missingMediaCount = missingMediaKeys.size

  const checkMissingMedia = useCallback(async () => {
    if (!isAuthorized) {
      setMissingMediaKeys(new Set())
      return
    }

    setIsCheckingMissingMedia(true)

    try {
      const response = await fetch('/api/product-media/reconcile', {
        body: JSON.stringify({ dryRun: true }),
        headers: {
          'content-type': 'application/json',
          'x-drop-admin-password': adminPassword.trim(),
        },
        method: 'POST',
      })
      const payload = (await response.json().catch(() => null)) as {
        error?: string
        missing?: Array<{ pathname: string; productId: string }>
      } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Could not check for missing media files.')
      }

      setMissingMediaKeys(new Set(
        (payload?.missing ?? []).map((item) => `${item.productId}:${item.pathname}`),
      ))
    } catch {
      setMissingMediaKeys(new Set())
    } finally {
      setIsCheckingMissingMedia(false)
    }
  }, [adminPassword, isAuthorized])

  const pruneMissingMedia = async () => {
    if (missingMediaCount === 0) {
      return
    }

    const confirmed = window.confirm(
      `Remove ${missingMediaCount} missing media reference${missingMediaCount === 1 ? '' : 's'} from product metadata?`,
    )

    if (!confirmed) {
      return
    }

    setIsPruningMissingMedia(true)
    setAdminError('')
    setAdminMessage('')

    try {
      const response = await fetch('/api/product-media/reconcile', {
        body: JSON.stringify({ dryRun: false }),
        headers: {
          'content-type': 'application/json',
          'x-drop-admin-password': adminPassword.trim(),
        },
        method: 'POST',
      })
      const payload = (await response.json().catch(() => null)) as {
        error?: string
        removed?: Array<{ pathname: string; productId: string }>
      } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Could not remove missing media references.')
      }

      const removed = payload?.removed ?? []
      onProductMediaReconciled(removed)
      setMissingMediaKeys(new Set())
      setAdminMessage(
        removed.length === 0
          ? 'No missing media references were removed.'
          : `Removed ${removed.length} missing media reference${removed.length === 1 ? '' : 's'}.`,
      )
    } catch (error) {
      setAdminError(
        error instanceof Error ? error.message : 'Could not remove missing media references.',
      )
    } finally {
      setIsPruningMissingMedia(false)
    }
  }

  useEffect(() => {
    if (!isAuthorized) {
      setMissingMediaKeys(new Set())
      return
    }

    void checkMissingMedia()
  }, [checkMissingMedia, isAuthorized, productMediaByProduct])

  const saveProductName = async (event: FormEvent<HTMLFormElement>, product: Product) => {
    event.preventDefault()
    const name = editingProductName.trim().replace(/\s+/g, ' ')

    if (!name) {
      setAdminError('Enter a product name.')
      return
    }

    setSavingProductId(product.id)
    setAdminError('')
    setAdminMessage('')

    try {
      const response = await fetch('/api/product-media/product', {
        body: JSON.stringify({ name, productId: product.id }),
        headers: {
          'content-type': 'application/json',
          'x-drop-admin-password': adminPassword.trim(),
        },
        method: 'PATCH',
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Could not rename that product.')
      }

      onProductRenamed(product.id, name)
      setEditingProductId('')
      setEditingProductName('')
      setAdminMessage(`Renamed product to ${name}.`)
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Could not rename that product.')
    } finally {
      setSavingProductId('')
    }
  }

  const deleteProductMedia = async (product: Product, asset: ProductMedia) => {
    const assetPathname = asset.pathname ?? asset.id
    const mediaKey = `${product.id}:${assetPathname}`
    const confirmed = window.confirm(
      `Remove this ${asset.kind} from ${product.name}?`,
    )

    if (!confirmed) {
      return
    }

    setDeletingMediaKey(mediaKey)
    setAdminError('')
    setAdminMessage('')

    try {
      const response = await fetch('/api/product-media/asset', {
        body: JSON.stringify({ pathname: assetPathname, productId: product.id }),
        headers: {
          'content-type': 'application/json',
          'x-drop-admin-password': adminPassword.trim(),
        },
        method: 'DELETE',
      })
      const payload = (await response.json().catch(() => null)) as {
        error?: string
        retainedBlob?: boolean
      } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Could not delete that media file.')
      }

      onProductMediaDeleted(product.id, assetPathname)
      setAdminMessage(
        payload?.retainedBlob
          ? `Removed media from ${product.name}. The shared drop film file was kept.`
          : `Removed media from ${product.name}.`,
      )
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Could not delete that media file.')
    } finally {
      setDeletingMediaKey('')
    }
  }

  const deleteProduct = async (product: Product) => {
    const confirmed = window.confirm(
      `Remove ${product.name} from the storefront? Its hosted media files will be retained for recovery.`,
    )

    if (!confirmed) {
      return
    }

    setDeletingProductId(product.id)
    setAdminError('')
    setAdminMessage('')

    try {
      const response = await fetch('/api/product-media/product', {
        body: JSON.stringify({ productId: product.id }),
        headers: {
          'content-type': 'application/json',
          'x-drop-admin-password': adminPassword.trim(),
        },
        method: 'DELETE',
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Could not delete that product.')
      }

      onProductDeleted(product.id)
      setAdminMessage(`${product.name} was removed. Its hosted media files were kept.`)
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Could not delete that product.')
    } finally {
      setDeletingProductId('')
    }
  }

  const toggleProductCategory = async (product: Product, category: ProductCategory) => {
    const currentCategories = product.categories ?? []
    const categories = currentCategories.includes(category)
      ? currentCategories.filter((item) => item !== category)
      : [...currentCategories, category]

    setTaggingProductId(product.id)
    setAdminError('')
    setAdminMessage('')

    try {
      const response = await fetch('/api/product-media/product', {
        body: JSON.stringify({ categories, productId: product.id }),
        headers: {
          'content-type': 'application/json',
          'x-drop-admin-password': adminPassword.trim(),
        },
        method: 'PATCH',
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Could not update product categories.')
      }

      onProductCategoriesChanged(product.id, categories)
      setAdminMessage(`Updated categories for ${product.name}.`)
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Could not update product categories.')
    } finally {
      setTaggingProductId('')
    }
  }

  const saveProductCommerce = async (event: FormEvent<HTMLFormElement>, product: Product) => {
    event.preventDefault()
    const price = Number(editingPrice)
    const inventoryQuantity = Number(editingQuantity)

    if (!Number.isFinite(price) || price < 0) {
      setAdminError('Enter a valid price of zero or more.')
      return
    }

    if (!Number.isInteger(inventoryQuantity) || inventoryQuantity < 0) {
      setAdminError('Enter a whole-number quantity of zero or more.')
      return
    }

    setSavingCommerceProductId(product.id)
    setAdminError('')
    setAdminMessage('')

    try {
      const response = await fetch('/api/product-media/product', {
        body: JSON.stringify({ inventoryQuantity, price, productId: product.id }),
        headers: {
          'content-type': 'application/json',
          'x-drop-admin-password': adminPassword.trim(),
        },
        method: 'PATCH',
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Could not update price and quantity.')
      }

      onProductCommerceChanged(product.id, price, inventoryQuantity)
      setEditingCommerceProductId('')
      setEditingPrice('')
      setEditingQuantity('')
      setAdminMessage(`Updated price and quantity for ${product.name}.`)
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Could not update price and quantity.')
    } finally {
      setSavingCommerceProductId('')
    }
  }

  const verifyLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const password = adminPassword.trim()

    if (!password) {
      setAdminError('Enter the admin password.')
      return
    }

    setIsCheckingLogin(true)
    setAdminError('')
    setAdminMessage('')

    try {
      const response = await fetch('/api/drop-films/admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!response.ok) {
        setIsAuthorized(false)
        throw new Error('That password did not unlock the film admin.')
      }

      window.sessionStorage.setItem('saltwater-drop-film-password', password)
      window.sessionStorage.setItem('saltwater-drop-film-authorized', 'true')
      setAdminPassword(password)
      setIsAuthorized(true)
      setAdminMessage('Admin unlocked.')
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Could not unlock admin.')
    } finally {
      setIsCheckingLogin(false)
    }
  }

  const signOut = () => {
    window.sessionStorage.removeItem('saltwater-drop-film-password')
    window.sessionStorage.removeItem('saltwater-drop-film-authorized')
    setAdminPassword('')
    setIsAuthorized(false)
    setAdminMessage('')
    setAdminError('')
    setPendingProductMediaFiles([])
    setProductMediaUploadProgress(0)
  }

  const handleFilmFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null
    setSelectedFile(file)
    setVideoDuration(undefined)
    setAdminError('')
    setAdminMessage('')
    setUploadProgress(0)

    if (!file) {
      return
    }

    if (!isAcceptedDropFilmFile(file)) {
      setAdminError('Choose an MP4, MOV, or WebM video.')
      return
    }

    if (file.size > maxDropFilmBytes) {
      setAdminError(`Keep each film under ${formatFileSize(maxDropFilmBytes)}.`)
      return
    }

    try {
      const duration = await readVideoDuration(file)
      setVideoDuration(duration)

      if (duration > maxDropFilmSeconds + dropFilmDurationTolerance) {
        setAdminError(`This film is ${formatDuration(duration)}. Keep drop films at 0:30 or shorter.`)
      }

      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))
      }
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Could not read that video.')
    }
  }

  const handleProductMediaFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    setAdminError('')
    setAdminMessage('')
    setProductMediaUploadProgress(0)

    if (files.length === 0) {
      setPendingProductMediaFiles([])
      return
    }

    const unsupportedFile = files.find((file) => !isAcceptedProductMediaFile(file))

    if (unsupportedFile) {
      setAdminError(`${unsupportedFile.name} is not a supported image or video file.`)
      return
    }

    const oversizedFile = files.find((file) => file.size > maxProductMediaBytes)

    if (oversizedFile) {
      setAdminError(`${oversizedFile.name} is over ${formatFileSize(maxProductMediaBytes)}.`)
      return
    }

    const assignments = files.map((file, index) => ({
      file,
      id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
      productId: matchProductIdFromFileName(file.name, products),
    }))
    const unmatchedCount = assignments.filter((item) => !item.productId).length

    setPendingProductMediaFiles(assignments)

    if (unmatchedCount > 0) {
      setAdminMessage(
        `${files.length - unmatchedCount} files grouped automatically. Review ${unmatchedCount} unmatched file${unmatchedCount === 1 ? '' : 's'} below.`,
      )
    }
  }

  const saveFilmMetadata = async (blob: PutBlobResult, resolvedTitle: string) => {
    const response = await fetch('/api/drop-films/metadata', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-drop-admin-password': adminPassword.trim(),
      },
      body: JSON.stringify({
        blob,
        durationSeconds: videoDuration,
        title: resolvedTitle,
      }),
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      throw new Error(payload?.error ?? 'The video uploaded, but its title metadata was not saved.')
    }
  }

  const saveProductMediaMetadata = async (
    product: Product,
    uploads: Array<{ blob: PutBlobResult; file: File; sortOrder: number }>,
  ): Promise<ProductMedia[]> => {
    const response = await fetch('/api/product-media/metadata', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-drop-admin-password': adminPassword.trim(),
      },
      body: JSON.stringify({
        assets: uploads.map(({ blob, file, sortOrder }) => ({
          blob,
          contentType: file.type,
          kind: productMediaKindFromFile(file),
          sortOrder,
          title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
        })),
        product,
        productId: product.id,
      }),
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      throw new Error(payload?.error ?? 'The media uploaded, but its metadata was not saved.')
    }

    const payload = (await response.json().catch(() => null)) as { media?: ProductMedia[] } | null
    return Array.isArray(payload?.media) ? payload.media : []
  }

  const uploadFilm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedFile) {
      setAdminError('Choose a video before uploading.')
      return
    }

    const resolvedTitle = title.trim() || selectedFile.name.replace(/\.[^.]+$/, '')

    if (!isAcceptedDropFilmFile(selectedFile)) {
      setAdminError('Choose an MP4, MOV, or WebM video.')
      return
    }

    if (selectedFile.size > maxDropFilmBytes) {
      setAdminError(`Keep each film under ${formatFileSize(maxDropFilmBytes)}.`)
      return
    }

    if (
      typeof videoDuration === 'number' &&
      videoDuration > maxDropFilmSeconds + dropFilmDurationTolerance
    ) {
      setAdminError(`This film is ${formatDuration(videoDuration)}. Keep drop films at 0:30 or shorter.`)
      return
    }

    setIsUploading(true)
    setAdminError('')
    setAdminMessage('')
    setUploadProgress(1)

    try {
      const { upload } = await import('@vercel/blob/client')
      const blob = await upload(createDropFilmPath(resolvedTitle, selectedFile), selectedFile, {
        access: 'public',
        clientPayload: JSON.stringify({
          durationSeconds: videoDuration,
          title: resolvedTitle,
        }),
        contentType: selectedFile.type || undefined,
        handleUploadUrl: '/api/drop-films/upload',
        headers: {
          'x-drop-admin-password': adminPassword.trim(),
        },
        multipart: selectedFile.size > 8 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => {
          setUploadProgress(Math.max(1, Math.round(percentage)))
        },
      })

      await saveFilmMetadata(blob, resolvedTitle)
      await onFilmsRefresh()
      setAdminMessage(`${resolvedTitle} is live in Drop Films.`)
      setTitle('')
      setSelectedFile(null)
      setVideoDuration(undefined)
      setUploadProgress(100)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Upload failed.')
      setUploadProgress(0)
    } finally {
      setIsUploading(false)
    }
  }

  const uploadProductMedia = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (pendingProductMediaFiles.length === 0) {
      setAdminError('Choose at least one product image or video.')
      return
    }

    const unsupportedFile = pendingProductMediaFiles
      .map((item) => item.file)
      .find((file) => !isAcceptedProductMediaFile(file))

    if (unsupportedFile) {
      setAdminError(`${unsupportedFile.name} is not a supported image or video file.`)
      return
    }

    const oversizedFile = pendingProductMediaFiles
      .map((item) => item.file)
      .find((file) => file.size > maxProductMediaBytes)

    if (oversizedFile) {
      setAdminError(`${oversizedFile.name} is over ${formatFileSize(maxProductMediaBytes)}.`)
      return
    }

    if (unassignedProductMediaFiles.length > 0) {
      setAdminError('Assign every file to a product before uploading.')
      return
    }

    setIsUploadingProductMedia(true)
    setAdminError('')
    setAdminMessage('')
    setProductMediaUploadProgress(1)

    try {
      const { upload } = await import('@vercel/blob/client')
      let completedFiles = 0

      for (const group of pendingProductGroups) {
        const existingMedia = productMediaByProduct[group.product.id] ?? []
        const existingMaxSortOrder = existingMedia.reduce(
          (maximum, item) => Math.max(maximum, item.sortOrder ?? -1),
          -1,
        )
        const orderedFiles = [...group.files].sort((left, right) => {
          const leftKind = productMediaKindFromFile(left.file)
          const rightKind = productMediaKindFromFile(right.file)

          if (leftKind === rightKind) {
            return 0
          }

          return leftKind === 'image' ? -1 : 1
        })
        const uploadedAssets: Array<{ blob: PutBlobResult; file: File; sortOrder: number }> = []

        for (const [index, item] of orderedFiles.entries()) {
          const file = item.file
          const kind = productMediaKindFromFile(file)

          if (!kind) {
            throw new Error(`${file.name} is not a supported image or video file.`)
          }

          const blob = await upload(createProductMediaPath(group.product.id, file, index), file, {
            access: 'public',
            clientPayload: JSON.stringify({
              kind,
              productId: group.product.id,
              skuName: group.product.name,
              title: file.name,
            }),
            contentType: file.type || undefined,
            handleUploadUrl: '/api/product-media/upload',
            headers: {
              'x-drop-admin-password': adminPassword.trim(),
            },
            multipart: file.size > 8 * 1024 * 1024,
            onUploadProgress: ({ percentage }) => {
              const nextProgress = (
                (completedFiles + percentage / 100) / pendingProductMediaFiles.length
              ) * 100
              setProductMediaUploadProgress(Math.max(1, Math.round(nextProgress)))
            },
          })

          uploadedAssets.push({
            blob,
            file,
            sortOrder: existingMaxSortOrder + index + 1,
          })
          completedFiles += 1
        }

        const savedMedia = await saveProductMediaMetadata(group.product, uploadedAssets)

        if (savedMedia.length > 0) {
          setProductMediaByProduct((current) => {
            const productId = group.product.id
            const existingMedia = current[productId] ?? []
            const normalizedNew = savedMedia
              .filter((item) => item.url && (item.kind === 'image' || item.kind === 'video'))
              .map((item) => ({
                ...item,
                id: item.pathname ?? item.id ?? item.url,
                productId,
                skuName: item.skuName?.trim() || productSkuNameFromFileName(item.title ?? ''),
              }))
            const newPathnames = new Set(normalizedNew.map((item) => item.pathname ?? item.id))
            const mergedMedia = [
              ...normalizedNew,
              ...existingMedia.filter((item) => !newPathnames.has(item.pathname ?? item.id)),
            ].sort(compareProductMedia)

            return {
              ...current,
              [productId]: mergedMedia,
            }
          })
        }
      }

      setAdminMessage(
        `${pendingProductMediaFiles.length} files organized across ${pendingProductGroups.length} SKU${pendingProductGroups.length === 1 ? '' : 's'}.`,
      )
      setPendingProductMediaFiles([])
      setProductMediaUploadProgress(100)
      if (productMediaInputRef.current) {
        productMediaInputRef.current.value = ''
      }
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Product media upload failed.')
      setProductMediaUploadProgress(0)
    } finally {
      setIsUploadingProductMedia(false)
    }
  }

  return (
    <section className="film-admin-page" data-no-splash aria-labelledby="film-admin-title">
      <div className="film-admin-header">
        <p className="eyebrow">
          <Film size={16} />
          Media admin
        </p>
        <h1 id="film-admin-title">Upload product media and drop films.</h1>
        <a className="button ghost-button" href="#films">
          Back to storefront
        </a>
      </div>

      {!isAuthorized ? (
        <form className="film-admin-card film-admin-login" onSubmit={verifyLogin}>
          <label>
            <span>Admin password</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setAdminPassword(event.target.value)}
              type="password"
              value={adminPassword}
            />
          </label>
          <button className="button primary-button" disabled={isCheckingLogin} type="submit">
            <Lock size={17} />
            {isCheckingLogin ? 'Checking' : 'Enter admin'}
          </button>
          {adminError ? <p className="admin-error">{adminError}</p> : null}
          {adminMessage ? <p className="admin-success">{adminMessage}</p> : null}
        </form>
      ) : (
        <div className="film-admin-grid media-admin-grid">
          {adminError || adminMessage ? (
            <div className="admin-feedback-row">
              {adminError ? <p className="admin-error">{adminError}</p> : null}
              {adminMessage ? <p className="admin-success">{adminMessage}</p> : null}
            </div>
          ) : null}

          <form className="film-admin-card film-upload-form" onSubmit={uploadFilm}>
            <div className="film-admin-card-head">
              <div>
                <strong>New drop film</strong>
                <span>MP4, MOV, or WebM · 0:30 max · {formatFileSize(maxDropFilmBytes)} max</span>
              </div>
              <button className="button ghost-button" onClick={signOut} type="button">
                Sign out
              </button>
            </div>

            <label>
              <span>Film title</span>
              <input
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Sea Glass Squeeze"
                type="text"
                value={title}
              />
            </label>

            <label className="film-file-picker">
              <span>Video file</span>
              <input
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                onChange={handleFilmFileChange}
                ref={fileInputRef}
                type="file"
              />
            </label>

            {selectedFile ? (
              <div className="film-file-summary">
                <strong>{selectedFile.name}</strong>
                <span>
                  {formatFileSize(selectedFile.size)} · {formatDuration(videoDuration)}
                </span>
              </div>
            ) : null}

            {uploadProgress > 0 ? (
              <div className="upload-progress" aria-label={`Upload ${uploadProgress}% complete`}>
                <span style={{ width: `${uploadProgress}%` }} />
              </div>
            ) : null}

            <button className="button primary-button" disabled={isUploading} type="submit">
              <Upload size={17} />
              {isUploading ? `Uploading ${uploadProgress}%` : 'Upload film'}
            </button>
          </form>

          <form className="film-admin-card product-media-upload-form" onSubmit={uploadProductMedia}>
            <div className="film-admin-card-head">
              <div>
                <strong>Product media</strong>
                <span>Images or videos · multiple files · {formatFileSize(maxProductMediaBytes)} max each</span>
              </div>
              <button
                className="icon-button"
                onClick={() => void onProductMediaRefresh()}
                title="Refresh product media"
                type="button"
              >
                <RefreshCw size={17} />
              </button>
            </div>

            <label className="film-file-picker">
              <span>Images and videos</span>
              <input
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,.jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm"
                multiple
                onChange={handleProductMediaFileChange}
                ref={productMediaInputRef}
                type="file"
              />
            </label>

            {pendingProductMediaFiles.length > 0 ? (
              <div className="product-upload-review">
                <div className="product-upload-summary">
                  {pendingProductGroups.map(({ files, product }) => (
                    <span key={product.id}>
                      <strong>{product.sku}</strong>
                      {product.name} · {files.length}
                    </span>
                  ))}
                  {unassignedProductMediaFiles.length > 0 ? (
                    <span className="needs-review">
                      <strong>Review</strong>
                      {unassignedProductMediaFiles.length} unassigned
                    </span>
                  ) : null}
                </div>

                <div className="pending-product-file-list">
                  {pendingProductMediaFiles.map((item) => (
                    <label className={item.productId ? '' : 'needs-review'} key={item.id}>
                      <span>
                        <strong>{item.file.name}</strong>
                        <small>{formatFileSize(item.file.size)}</small>
                      </span>
                      <select
                        aria-label={`Product for ${item.file.name}`}
                        onChange={(event) => {
                          const productId = event.target.value
                          setPendingProductMediaFiles((current) =>
                            current.map((pendingItem) =>
                              pendingItem.id === item.id
                                ? { ...pendingItem, productId }
                                : pendingItem,
                            ),
                          )
                          setAdminError('')
                        }}
                        value={item.productId}
                      >
                        <option value="">Choose product</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.sku} · {product.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {productMediaUploadProgress > 0 ? (
              <div
                className="upload-progress"
                aria-label={`Product media upload ${productMediaUploadProgress}% complete`}
              >
                <span style={{ width: `${productMediaUploadProgress}%` }} />
              </div>
            ) : null}

            <button
              className="button primary-button"
              disabled={isUploadingProductMedia || unassignedProductMediaFiles.length > 0}
              type="submit"
            >
              <Upload size={17} />
              {isUploadingProductMedia
                ? `Uploading ${productMediaUploadProgress}%`
                : pendingProductMediaFiles.length > 0
                  ? `Upload ${pendingProductMediaFiles.length} files`
                  : 'Upload product media'}
            </button>
          </form>

          <aside className="film-admin-card film-admin-current" aria-label="Current uploaded films">
            <div className="film-admin-card-head">
              <div>
                <strong>Drop films</strong>
                <span>{uploadedFilms.length} live film{uploadedFilms.length === 1 ? '' : 's'}</span>
              </div>
              <button
                className="icon-button"
                onClick={() => void onFilmsRefresh()}
                title="Refresh films"
                type="button"
              >
                <RefreshCw size={17} />
              </button>
            </div>

            <div className="admin-film-list">
              {uploadedFilms.length === 0 ? (
                <p>No uploaded films yet. The storefront is showing preview tiles.</p>
              ) : (
                uploadedFilms.map((film) => (
                  <a href={film.url} key={film.id} rel="noreferrer" target="_blank">
                    <span className="admin-film-preview">
                      <Play size={16} />
                    </span>
                    <span>
                      <strong>{film.title}</strong>
                      <small>
                        {formatDuration(film.durationSeconds)} · {formatFileSize(film.size)}
                      </small>
                    </span>
                  </a>
                ))
              )}
            </div>
          </aside>

          <aside className="film-admin-card product-media-current" aria-label="Current product media">
            <div className="film-admin-card-head">
              <div>
                <strong>Product media library</strong>
                <span>
                  {uploadedProductMediaCount} hosted file
                  {uploadedProductMediaCount === 1 ? '' : 's'}
                  {missingMediaCount > 0
                    ? ` · ${missingMediaCount} missing`
                    : isCheckingMissingMedia
                      ? ' · checking files'
                      : ''}
                </span>
              </div>
              <div className="admin-product-media-library-actions">
                {missingMediaCount > 0 ? (
                  <button
                    className="button ghost-button admin-prune-missing-button"
                    disabled={isPruningMissingMedia || isCheckingMissingMedia}
                    onClick={() => void pruneMissingMedia()}
                    type="button"
                  >
                    <TriangleAlert size={15} />
                    {isPruningMissingMedia ? 'Removing' : 'Remove missing'}
                  </button>
                ) : null}
                <button
                  className="icon-button"
                  disabled={isCheckingMissingMedia || isPruningMissingMedia}
                  onClick={() => void onProductMediaRefresh()}
                  title="Refresh product media"
                  type="button"
                >
                  <RefreshCw size={17} />
                </button>
              </div>
            </div>

            <div className="admin-product-media-list">
              {products.map((product) => {
                const media = productMediaByProduct[product.id] ?? []
                const resolvedProduct = {
                  ...product,
                  name: productNameFromMedia(product, media),
                }

                return (
                  <article className="admin-product-media-group" key={product.id}>
                    <div className="admin-product-media-group-head">
                      {editingProductId === product.id ? (
                        <form
                          className="admin-product-name-form"
                          onSubmit={(event) => void saveProductName(event, product)}
                        >
                          <label className="sr-only" htmlFor={`product-name-${product.id}`}>
                            Product name
                          </label>
                          <input
                            autoFocus
                            id={`product-name-${product.id}`}
                            maxLength={100}
                            onChange={(event) => setEditingProductName(event.currentTarget.value)}
                            type="text"
                            value={editingProductName}
                          />
                          <button
                            aria-label={`Save name for ${resolvedProduct.name}`}
                            className="icon-button"
                            disabled={savingProductId === product.id}
                            title="Save product name"
                            type="submit"
                          >
                            <Check size={17} />
                          </button>
                          <button
                            aria-label="Cancel rename"
                            className="icon-button"
                            onClick={() => {
                              setEditingProductId('')
                              setEditingProductName('')
                            }}
                            title="Cancel rename"
                            type="button"
                          >
                            <X size={17} />
                          </button>
                        </form>
                      ) : (
                        <>
                          <div>
                            <strong>{resolvedProduct.name}</strong>
                            <small>
                              {product.sku} · {product.price === null
                                ? 'Price pending'
                                : currency.format(product.price)} · Qty {product.inventoryQuantity ?? 'Not set'} ·{' '}
                              {media.length} file{media.length === 1 ? '' : 's'}
                            </small>
                          </div>
                          <div className="admin-product-actions">
                            <button
                              aria-label={`Edit price and quantity for ${resolvedProduct.name}`}
                              className="icon-button"
                              onClick={() => {
                                setEditingCommerceProductId(product.id)
                                setEditingPrice(product.price === null ? '' : String(product.price))
                                setEditingQuantity(String(product.inventoryQuantity ?? 0))
                              }}
                              title="Edit price and quantity"
                              type="button"
                            >
                              <BadgeDollarSign size={17} />
                            </button>
                            <button
                              aria-label={`Rename ${resolvedProduct.name}`}
                              className="icon-button"
                              onClick={() => {
                                setEditingProductId(product.id)
                                setEditingProductName(resolvedProduct.name)
                              }}
                              title="Rename product"
                              type="button"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              aria-label={`Delete ${resolvedProduct.name}`}
                              className="icon-button admin-delete-button"
                              disabled={deletingProductId === product.id}
                              onClick={() => void deleteProduct(resolvedProduct)}
                              title="Delete product"
                              type="button"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    {editingCommerceProductId === product.id ? (
                      <form
                        className="admin-product-commerce-form"
                        onSubmit={(event) => void saveProductCommerce(event, product)}
                      >
                        <label htmlFor={`product-price-${product.id}`}>
                          <span>Price</span>
                          <span className="admin-number-input">
                            <span aria-hidden="true">$</span>
                            <input
                              autoFocus
                              id={`product-price-${product.id}`}
                              inputMode="decimal"
                              min="0"
                              onChange={(event) => setEditingPrice(event.currentTarget.value)}
                              placeholder="0.00"
                              required
                              step="0.01"
                              type="number"
                              value={editingPrice}
                            />
                          </span>
                        </label>
                        <label htmlFor={`product-quantity-${product.id}`}>
                          <span>Quantity</span>
                          <input
                            id={`product-quantity-${product.id}`}
                            inputMode="numeric"
                            min="0"
                            onChange={(event) => setEditingQuantity(event.currentTarget.value)}
                            required
                            step="1"
                            type="number"
                            value={editingQuantity}
                          />
                        </label>
                        <button
                          className="button primary-button admin-commerce-save"
                          disabled={savingCommerceProductId === product.id}
                          type="submit"
                        >
                          <Check size={16} />
                          Save
                        </button>
                        <button
                          aria-label="Cancel price and quantity edit"
                          className="icon-button"
                          onClick={() => {
                            setEditingCommerceProductId('')
                            setEditingPrice('')
                            setEditingQuantity('')
                          }}
                          title="Cancel"
                          type="button"
                        >
                          <X size={17} />
                        </button>
                      </form>
                    ) : null}
                    <div
                      aria-label={`Categories for ${resolvedProduct.name}`}
                      className="admin-product-categories"
                    >
                      {productCategories.map((category) => (
                        <button
                          aria-pressed={(product.categories ?? []).includes(category)}
                          className="admin-category-chip"
                          disabled={taggingProductId === product.id}
                          key={category}
                          onClick={() => void toggleProductCategory(product, category)}
                          type="button"
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                    {media.length > 0 ? (
                      <div className="admin-product-media-thumbs">
                        {media.map((item) => {
                          const assetPathname = item.pathname ?? item.id
                          const mediaKey = `${product.id}:${assetPathname}`
                          const isMissing = missingMediaKeys.has(mediaKey)

                          return (
                            <div
                              className={`admin-product-media-thumb${isMissing ? ' is-missing' : ''}`}
                              key={item.id}
                            >
                              <a
                                aria-label={
                                  isMissing
                                    ? `${item.kind} missing from blob storage`
                                    : `Open ${item.kind}`
                                }
                                href={item.url}
                                rel="noreferrer"
                                target="_blank"
                              >
                                <ProductVisual media={item} product={resolvedProduct} />
                                {item.kind === 'video' ? <Play aria-hidden="true" size={13} /> : null}
                                {isMissing ? (
                                  <span className="admin-media-missing-badge">
                                    <TriangleAlert aria-hidden="true" size={11} />
                                    Missing
                                  </span>
                                ) : null}
                              </a>
                              <button
                                aria-label={`Delete ${item.kind} for ${resolvedProduct.name}`}
                                className="admin-media-delete-button"
                                disabled={deletingMediaKey === mediaKey}
                                onClick={() => void deleteProductMedia(resolvedProduct, item)}
                                title={isMissing ? 'Remove missing reference' : 'Delete media'}
                                type="button"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          </aside>
        </div>
      )}
    </section>
  )
}

function AboutSection() {
  return (
    <section className="about-section" id="about" aria-labelledby="about-title">
      <div aria-hidden="true" className="about-tide-wash" />
      <div className="about-section-inner">
        <figure className="about-keepsake">
          <div className="about-photo-frame">
            <picture>
              <source srcSet={aboutBeachPhotoWebp} type="image/webp" />
              <img
                alt="Ira and Joni standing with bodyboards on the beach in Half Moon Bay."
                decoding="async"
                height="1183"
                loading="lazy"
                src={aboutBeachPhoto}
                width="692"
              />
            </picture>
            <span aria-hidden="true" className="about-frame-shell">
              <Shell size={22} strokeWidth={1.8} />
            </span>
          </div>
          <figcaption>
            <MapPin aria-hidden="true" size={15} />
            Half Moon Bay, California
          </figcaption>
        </figure>

        <div className="about-section-copy">
          <p className="eyebrow">
            <Sparkles size={16} />
            Meet the squish testers
          </p>
          <h2 aria-label="Hi, we're Ira and Joni." id="about-title">
            <KineticText lines={["Hi, we're", 'Ira & Joni.']} tone="lagoon" />
          </h2>
          <div className="about-intro">
            <p>
              We're two friends who bonded over the beach, making art, and squishies. Ira is five,
              Joni is eleven, and between us there's almost always something being squished.
            </p>
            <p>
              We handpick our favorites, from slow-rise and crunchy to slushy and sugar-coated.
              That's how Saltwater Squish began.
            </p>
          </div>

          <blockquote className="about-squish-test">
            <span>Our house rule</span>
            <p>
              If it doesn't pass the official Ira-and-Joni squish test, it doesn't make it onto the
              shelf.
            </p>
          </blockquote>

          <div className="about-coast-note">
            <Heart aria-hidden="true" size={22} />
            <div>
              <strong>Taking care of our coast</strong>
              <p>
                We set aside a portion of every sale for environmental giving through{' '}
                <a href="https://www.onepercentfortheplanet.org/" rel="noreferrer" target="_blank">
                  1% for the Planet <ExternalLink size={14} />
                </a>{' '}
                and{' '}
                <a href="https://www.seahugger.org/" rel="noreferrer" target="_blank">
                  Sea Hugger <ExternalLink size={14} />
                </a>
                .
              </p>
            </div>
          </div>

          <div className="about-signature">
            <span>Thanks for squishing with us,</span>
            <strong>Ira &amp; Joni</strong>
          </div>
        </div>
      </div>
    </section>
  )
}

const policyCopy = {
  shipping: {
    eyebrow: 'From our coast to your door',
    intro:
      'We pack every order in Half Moon Bay and send tracking as soon as your squishies begin their trip.',
    sections: [
      {
        heading: 'Packing time',
        body:
          'Orders are usually packed within 2–3 business days. New drops and holidays may take up to 5 business days. Weekends and holidays begin processing on the next business day.',
      },
      {
        heading: 'Rates and delivery',
        body:
          'Available destinations, shipping rates, and carrier estimates appear at Shopify checkout. Delivery estimates begin after the carrier receives your package and are not guaranteed arrival dates.',
      },
      {
        heading: 'Tracking and address changes',
        body:
          'A tracking link is emailed when your order ships. If an address needs to change, reply to your order confirmation right away. We can only update it before the order is packed.',
      },
      {
        heading: 'A package needs help',
        body:
          'If tracking stalls or your parcel arrives damaged, reply to your order email within 7 days. Include the order number and photos of the package so we can help investigate.',
      },
    ],
    title: 'Shipping',
  },
  returns: {
    eyebrow: 'A gentle return trip',
    intro:
      'We hope every pick passes your squish test. If an unopened item is not right, contact us within 14 days of delivery.',
    sections: [
      {
        heading: 'Return eligibility',
        body:
          'Items must be unused, unopened, and in their original packaging. Please reply to your order confirmation for approval before mailing anything back. Returns sent without approval may be delayed.',
      },
      {
        heading: 'Opened squishies',
        body:
          'Opened or used sensory toys are final sale for hygiene and safety reasons. Items damaged through play, chewing, improper storage, or normal wear are not eligible for return.',
      },
      {
        heading: 'Damaged, defective, or incorrect',
        body:
          'Tell us within 7 days of delivery and include your order number plus clear photos of the item, packaging, and shipping label. We will review the issue and offer a replacement or refund when appropriate.',
      },
      {
        heading: 'Refunds and postage',
        body:
          'Approved refunds return to the original payment method after inspection. Original shipping and return postage are not refundable unless we sent the wrong item or the order arrived damaged. Banks may need 5–10 business days to post a refund.',
      },
    ],
    title: 'Returns',
  },
  safety: {
    eyebrow: 'Squish kindly',
    intro:
      'Squishies are sensory toys, not food. Grown-ups should choose and supervise play for each child.',
    sections: [
      {
        heading: 'Age and supervision',
        body:
          'Not for children under 3 years. Small pieces can become a choking hazard. Follow the age guidance on each product’s packaging, especially when it recommends an older age.',
      },
      {
        heading: 'Before every squeeze',
        body:
          'Inspect the toy before use. Stop using it immediately if it tears, cracks, leaks, becomes sticky in an unexpected way, develops an unusual odor, or releases any pieces. Keep all packaging away from young children.',
      },
      {
        heading: 'Play and care',
        body:
          'Do not bite, chew, puncture, ingest, or use near the eyes. Keep away from pets, heat, flames, and sharp objects. Materials and care vary, so keep the maker’s packaging and follow its instructions. When permitted, wipe gently with a damp cloth rather than soaking.',
      },
      {
        heading: 'If something goes wrong',
        body:
          'Stop play and move the toy and any loose pieces out of reach. Rinse exposed skin or eyes with clean water and seek medical advice if irritation continues. If any material is swallowed, contact Poison Control or a medical professional promptly.',
      },
    ],
    title: 'Safety',
  },
} satisfies Record<PolicyKind, {
  eyebrow: string
  intro: string
  sections: { body: string; heading: string }[]
  title: string
}>

function PolicyModal({ kind, onClose }: { kind: PolicyKind; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useRef<HTMLElement | null>(null)
  const policy = policyCopy[kind]

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      onClose()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>('button, a[href]') ?? [],
    ).filter((element) => !element.hasAttribute('disabled'))

    if (focusable.length === 0) {
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <>
      <button
        aria-label={`Close ${policy.title}`}
        className="policy-backdrop"
        onClick={onClose}
        type="button"
      />
      <section
        aria-labelledby={`policy-${kind}-title`}
        aria-modal="true"
        className={`policy-dialog policy-dialog-${kind}`}
        data-no-splash
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <header className="policy-dialog-header">
          <div className="policy-dialog-heading">
            <span aria-hidden="true" className="policy-dialog-icon">
              {kind === 'shipping' ? <Package size={24} /> : null}
              {kind === 'returns' ? <RotateCcw size={24} /> : null}
              {kind === 'safety' ? <ShieldCheck size={24} /> : null}
            </span>
            <div>
              <p className="eyebrow">{policy.eyebrow}</p>
              <h2 id={`policy-${kind}-title`}>{policy.title}</h2>
            </div>
          </div>
          <button
            aria-label={`Close ${policy.title}`}
            className="icon-button policy-close-button"
            onClick={onClose}
            ref={closeButtonRef}
            title="Close"
            type="button"
          >
            <X size={20} />
          </button>
        </header>

        <p className="policy-dialog-intro">{policy.intro}</p>

        <div className="policy-dialog-sections">
          {policy.sections.map((section) => (
            <section key={section.heading}>
              <h3>{section.heading}</h3>
              <p>{section.body}</p>
            </section>
          ))}
        </div>

        <p className="policy-dialog-footnote">
          Questions? Reply to your order confirmation and a grown-up from our shore will help.
        </p>
      </section>
    </>
  )
}

function App() {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All')
  const [cart, setCart] = useState<Cart>({})
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [products, setProducts] = useState<Product[]>(catalogProducts)
  const [dropFilms, setDropFilms] = useState<DropFilm[]>(placeholderDropFilms)
  const [dropFilmsStatus, setDropFilmsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [productMediaByProduct, setProductMediaByProduct] = useState<ProductMediaByProduct>({})
  const [productMediaStatus, setProductMediaStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [shopifyStatus, setShopifyStatus] = useState<
    'idle' | 'loading' | 'ready' | 'unconfigured' | 'error'
  >('idle')
  const [hashRoute, setHashRoute] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.hash,
  )
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode)
  const [openPolicy, setOpenPolicy] = useState<PolicyKind | null>(null)
  const [splashes, setSplashes] = useState<Splash[]>([])
  const [flights, setFlights] = useState<Flight[]>([])
  const [liveMessage, setLiveMessage] = useState('')
  const cartButtonRef = useRef<HTMLButtonElement | null>(null)
  const bubbleFieldRef = useRef<HTMLDivElement | null>(null)
  const bubbleNodesRef = useRef<HTMLElement[]>([])
  const pointerFrameRef = useRef<number | null>(null)
  const shorelineFrameRef = useRef<number | null>(null)
  const pendingPointerRef = useRef({ x: 50, y: 45 })
  const reducedMotion = usePrefersReducedMotion()
  const isAdminRoute = hashRoute === '#admin' || hashRoute === '#films-admin'

  useEffect(() => {
    try {
      window.localStorage.setItem(themeStorageKey, themeMode)
    } catch {
      // The theme still works when browser storage is unavailable.
    }
  }, [themeMode])

  const loadDropFilms = useCallback(async () => {
    setDropFilmsStatus('loading')

    try {
      const endpoint = isAdminRoute ? `/api/drop-films?v=${Date.now()}` : '/api/drop-films'
      const response = await fetch(endpoint, {
        cache: isAdminRoute ? 'no-store' : 'default',
        headers: { accept: 'application/json' },
      })

      if (!response.ok) {
        throw new Error('Drop films are unavailable.')
      }

      const data = (await response.json()) as DropFilmsResponse
      setDropFilms(normalizeDropFilms(data))
      setDropFilmsStatus('ready')
    } catch {
      setDropFilms(placeholderDropFilms)
      setDropFilmsStatus('error')
    }
  }, [isAdminRoute])

  const loadProductMedia = useCallback(async () => {
    setProductMediaStatus('loading')

    try {
      const endpoint = isAdminRoute ? `/api/product-media?v=${Date.now()}` : '/api/product-media'
      const response = await fetch(endpoint, {
        cache: isAdminRoute ? 'no-store' : 'default',
        headers: { accept: 'application/json' },
      })

      if (!response.ok) {
        throw new Error('Product media is unavailable.')
      }

      const data = (await response.json()) as ProductMediaResponse
      setProductMediaByProduct(normalizeProductMedia(data))
      const normalizedProducts = normalizeCatalogProducts(data)
      setProducts((currentProducts) =>
        normalizedProducts.map((product) => {
          const currentProduct = currentProducts.find((item) => item.id === product.id)

          if (!currentProduct?.shopifyVariantId) {
            return product
          }

          return {
            ...product,
            availableForSale: currentProduct.availableForSale,
            currencyCode: currentProduct.currencyCode,
            price: currentProduct.price,
            shopifyHandle: currentProduct.shopifyHandle,
            shopifyProductId: currentProduct.shopifyProductId,
            shopifyVariantId: currentProduct.shopifyVariantId,
          }
        }),
      )
      setProductMediaStatus('ready')
    } catch {
      setProductMediaByProduct({})
      setProducts((currentProducts) =>
        currentProducts.some((product) => product.shopifyVariantId)
          ? currentProducts
          : catalogProducts,
      )
      setProductMediaStatus('error')
    }
  }, [isAdminRoute])

  const loadShopifyCatalog = useCallback(async () => {
    setShopifyStatus('loading')

    try {
      const response = await fetch('/api/shopify/catalog', {
        headers: { accept: 'application/json' },
      })
      const data = (await response.json()) as ShopifyCatalogResponse

      if (!response.ok) {
        throw new Error('Shopify catalog is unavailable.')
      }

      if (!data.configured) {
        setShopifyStatus('unconfigured')
        return
      }

      const productsBySku = data.productsBySku ?? {}
      setProducts((currentProducts) =>
        currentProducts.map((product) => {
          const variant = productsBySku[product.sku.toUpperCase()]

          if (!variant) {
            return {
              ...product,
              availableForSale: false,
              shopifyHandle: undefined,
              shopifyProductId: undefined,
              shopifyVariantId: undefined,
            }
          }

          const price = Number(variant.price)

          return {
            ...product,
            availableForSale: variant.availableForSale,
            currencyCode: variant.currencyCode,
            price: Number.isFinite(price) ? price : null,
            shopifyHandle: variant.handle,
            shopifyProductId: variant.productId,
            shopifyVariantId: variant.variantId,
          }
        }),
      )
      setShopifyStatus('ready')
    } catch {
      setShopifyStatus('error')
    }
  }, [])

  useEffect(() => {
    const loadStorefrontMedia = () => {
      void Promise.all([loadDropFilms(), loadProductMedia(), loadShopifyCatalog()])
    }

    if (isAdminRoute) {
      void loadDropFilms()
      void loadProductMedia()
      return
    }

    return scheduleIdleTask(loadStorefrontMedia)
  }, [isAdminRoute, loadDropFilms, loadProductMedia, loadShopifyCatalog])

  useEffect(() => {
    const updateHashRoute = () => {
      setHashRoute(window.location.hash)
      setMobileNavOpen(false)
    }

    updateHashRoute()
    window.addEventListener('hashchange', updateHashRoute)

    return () => window.removeEventListener('hashchange', updateHashRoute)
  }, [])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!hashRoute || hashRoute === '#top') {
        window.scrollTo({ behavior: 'auto', top: 0 })
        return
      }

      const routeTarget = hashRoute ? document.querySelector(hashRoute) : null

      if (routeTarget) {
        routeTarget.scrollIntoView({ behavior: 'auto', block: 'start' })
      } else {
        window.scrollTo({ behavior: 'auto', top: 0 })
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [hashRoute])

  useEffect(() => {
    return () => {
      if (pointerFrameRef.current !== null) {
        window.cancelAnimationFrame(pointerFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isAdminRoute || reducedMotion || window.matchMedia('(max-width: 720px)').matches) {
      return
    }

    const siteShell = document.querySelector<HTMLElement>('.site-shell')
    const shorelines = document.querySelectorAll<HTMLElement>('[data-shoreline]')
    const parallaxProperties = [
      '--hero-photo-parallax',
      '--hero-tint-parallax',
      '--hero-content-parallax',
      '--tide-rise-slow',
      '--tide-rise-deep',
    ]

    const updateShorelineParallax = () => {
      shorelineFrameRef.current = null
      const viewportCenter = window.innerHeight / 2
      const scrollY = window.scrollY
      const heroTravel = Math.min(window.innerHeight, Math.max(0, scrollY))
      const tideRiseSlow = Math.sin(scrollY * 0.003) * 18
      const tideRiseDeep = Math.cos(scrollY * 0.0024) * 26
      const heroPhotoShift = Math.min(36, heroTravel * 0.044) * -1
      const heroContentShift = heroTravel * -0.032
      const shorelineOffsets = Array.from(shorelines, (shoreline) => {
        const bounds = shoreline.getBoundingClientRect()
        const centerDelta = bounds.top + bounds.height / 2 - viewportCenter

        return Math.max(-22, Math.min(22, centerDelta * -0.044))
      })

      siteShell?.style.setProperty('--hero-photo-parallax', `${heroPhotoShift.toFixed(1)}px`)
      siteShell?.style.setProperty('--hero-tint-parallax', `${(heroPhotoShift * 0.45).toFixed(1)}px`)
      siteShell?.style.setProperty('--hero-content-parallax', `${heroContentShift.toFixed(1)}px`)
      siteShell?.style.setProperty('--tide-rise-slow', `${tideRiseSlow.toFixed(1)}px`)
      siteShell?.style.setProperty('--tide-rise-deep', `${tideRiseDeep.toFixed(1)}px`)

      shorelines.forEach((shoreline, index) => {
        shoreline.style.setProperty('--shore-parallax', `${shorelineOffsets[index].toFixed(1)}px`)
      })
    }

    const scheduleShorelineParallax = () => {
      if (shorelineFrameRef.current !== null) {
        return
      }

      shorelineFrameRef.current = window.requestAnimationFrame(updateShorelineParallax)
    }

    shorelines.forEach((shoreline, index) => {
      shoreline.style.setProperty('--shore-phase', `${(index * -1.65).toFixed(2)}s`)
    })
    scheduleShorelineParallax()
    window.addEventListener('resize', scheduleShorelineParallax)
    window.addEventListener('scroll', scheduleShorelineParallax, { passive: true })

    return () => {
      window.removeEventListener('resize', scheduleShorelineParallax)
      window.removeEventListener('scroll', scheduleShorelineParallax)

      if (shorelineFrameRef.current !== null) {
        window.cancelAnimationFrame(shorelineFrameRef.current)
        shorelineFrameRef.current = null
      }

      parallaxProperties.forEach((property) => siteShell?.style.removeProperty(property))
      shorelines.forEach((shoreline) => {
        shoreline.style.removeProperty('--shore-parallax')
        shoreline.style.removeProperty('--shore-phase')
      })
    }
  }, [isAdminRoute, reducedMotion])

  const storefrontProducts = useMemo(
    () => products
      .filter((product) => product.status === 'published')
      .map((product) => {
        const resolvedName = productNameFromMedia(product, productMediaByProduct[product.id])

        return resolvedName === product.name ? product : { ...product, name: resolvedName }
      }),
    [productMediaByProduct, products],
  )

  const filteredProducts = useMemo(() => {
    return storefrontProducts.filter((product) =>
      activeCategory === 'All' || product.categories?.includes(activeCategory),
    )
  }, [activeCategory, storefrontProducts])

  const cartItems = useMemo(
    () =>
      storefrontProducts
        .filter((product) => cart[product.id])
        .map((product) => ({
          product,
          quantity: cart[product.id],
        })),
    [cart, storefrontProducts],
  )

  const subtotal = cartItems.reduce(
    (total, item) => total + (item.product.price ?? 0) * item.quantity,
    0,
  )
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0)

  const handleProductRenamed = (productId: string, name: string) => {
    setProducts((current) => current.map((product) => (
      product.id === productId ? { ...product, name } : product
    )))
    setProductMediaByProduct((current) => ({
      ...current,
      [productId]: (current[productId] ?? []).map((item) => ({ ...item, skuName: name })),
    }))
  }

  const handleProductCategoriesChanged = (
    productId: string,
    categories: ProductCategory[],
  ) => {
    setProducts((current) => current.map((product) => (
      product.id === productId ? { ...product, categories } : product
    )))
  }

  const handleProductCommerceChanged = (
    productId: string,
    price: number,
    inventoryQuantity: number,
  ) => {
    setProducts((current) => current.map((product) => (
      product.id === productId ? { ...product, inventoryQuantity, price } : product
    )))
  }

  const handleProductDeleted = (productId: string) => {
    setProducts((current) => current.filter((product) => product.id !== productId))
    setProductMediaByProduct((current) => {
      const next = { ...current }
      delete next[productId]
      return next
    })
    setCart((current) => {
      const next = { ...current }
      delete next[productId]
      return next
    })
  }

  const handleProductMediaDeleted = (productId: string, assetPathname: string) => {
    setProductMediaByProduct((current) => {
      const existingMedia = current[productId] ?? []
      const nextMedia = existingMedia.filter(
        (item) => (item.pathname ?? item.id) !== assetPathname,
      )

      if (nextMedia.length === existingMedia.length) {
        return current
      }

      return {
        ...current,
        [productId]: nextMedia,
      }
    })
  }

  const handleProductMediaReconciled = (
    removed: Array<{ pathname: string; productId: string }>,
  ) => {
    if (removed.length === 0) {
      return
    }

    const removedByProduct = removed.reduce<Record<string, Set<string>>>((groups, item) => {
      const pathnames = groups[item.productId] ?? new Set<string>()
      pathnames.add(item.pathname)
      groups[item.productId] = pathnames
      return groups
    }, {})

    setProductMediaByProduct((current) => {
      let changed = false
      const next = { ...current }

      for (const [productId, pathnames] of Object.entries(removedByProduct)) {
        const existingMedia = current[productId] ?? []
        const nextMedia = existingMedia.filter(
          (item) => !pathnames.has(item.pathname ?? item.id),
        )

        if (nextMedia.length !== existingMedia.length) {
          next[productId] = nextMedia
          changed = true
        }
      }

      return changed ? next : current
    })
  }

  const updateCart = (productId: string, delta: number) => {
    setCheckoutError('')
    setCart((currentCart) => {
      const product = storefrontProducts.find((item) => item.id === productId)
      const inventoryLimit = product?.inventoryQuantity ?? Number.POSITIVE_INFINITY
      const nextQuantity = Math.min(
        Math.max((currentCart[productId] ?? 0) + delta, 0),
        inventoryLimit,
      )
      const nextCart = { ...currentCart }

      if (nextQuantity === 0) {
        delete nextCart[productId]
      } else {
        nextCart[productId] = nextQuantity
      }

      return nextCart
    })
  }

  const addToCart = (product: Product, event: MouseEvent<HTMLButtonElement>) => {
    if (
      product.price === null ||
      product.inventoryQuantity === 0 ||
      (product.shopifyVariantId && product.availableForSale === false)
    ) {
      return
    }

    updateCart(product.id, 1)
    setCartOpen(true)
    setLiveMessage(`${product.name} added to cart.`)

    if (reducedMotion) {
      return
    }

    const cartRect = cartButtonRef.current?.getBoundingClientRect()
    const flight: Flight = {
      id: Date.now(),
      product,
      fromX: event.clientX,
      fromY: event.clientY,
      toX: cartRect ? cartRect.left + cartRect.width / 2 : window.innerWidth - 42,
      toY: cartRect ? cartRect.top + cartRect.height / 2 : 42,
    }

    setFlights((currentFlights) => [...currentFlights.slice(-3), flight])
    window.setTimeout(() => {
      setFlights((currentFlights) => currentFlights.filter((item) => item.id !== flight.id))
    }, 900)
  }

  const startShopifyCheckout = async () => {
    if (cartItems.length === 0) {
      return
    }

    const lines = cartItems.flatMap(({ product, quantity }) =>
      product.shopifyVariantId
        ? [{ merchandiseId: product.shopifyVariantId, quantity }]
        : [],
    )

    if (lines.length !== cartItems.length) {
      setCheckoutError('One or more products are not connected to Shopify yet.')
      return
    }

    setIsCheckingOut(true)
    setCheckoutError('')

    try {
      const response = await fetch('/api/shopify/cart', {
        body: JSON.stringify({ lines }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
      const payload = (await response.json().catch(() => null)) as ShopifyCartResponse | null

      if (!response.ok || !payload?.checkoutUrl) {
        throw new Error(payload?.error ?? 'Shopify checkout is unavailable.')
      }

      const checkoutUrl = new URL(payload.checkoutUrl)

      if (checkoutUrl.protocol !== 'https:') {
        throw new Error('Shopify returned an invalid checkout URL.')
      }

      window.location.assign(checkoutUrl.toString())
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Shopify checkout is unavailable.')
      setIsCheckingOut(false)
    }
  }

  const handleShellPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (reducedMotion) {
      return
    }

    const target = event.target as HTMLElement

    if (target.closest('[data-no-splash]')) {
      return
    }

    pendingPointerRef.current = {
      x: (event.clientX / window.innerWidth) * 100,
      y: (event.clientY / window.innerHeight) * 100,
    }

    if (pointerFrameRef.current !== null) {
      return
    }

    pointerFrameRef.current = window.requestAnimationFrame(() => {
      pointerFrameRef.current = null
      const pointer = pendingPointerRef.current

      if (bubbleNodesRef.current.length === 0) {
        bubbleNodesRef.current = Array.from(
          bubbleFieldRef.current?.querySelectorAll<HTMLElement>('.foam-bubble') ?? [],
        )
      }

      bubbleNodesRef.current.forEach((node, index) => {
        const bubble = ambientBubbles[index]

        if (!bubble) {
          return
        }

        const dx = bubble.x - pointer.x
        const dy = bubble.y - pointer.y
        const distance = Math.max(Math.hypot(dx, dy), 1)
        const influence = Math.max(0, 18 - distance) * bubble.depth

        node.style.setProperty('--repel-x', `${((dx / distance) * influence).toFixed(1)}px`)
        node.style.setProperty('--repel-y', `${((dy / distance) * influence).toFixed(1)}px`)
      })
    })
  }

  const handleShellPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || event.button !== 0) {
      return
    }

    const target = event.target as HTMLElement
    const isInteractive = target.closest(
      'a, button, input, textarea, select, summary, [role="button"], [data-no-splash]',
    )

    if (isInteractive) {
      return
    }

    const splash: Splash = {
      id: Date.now(),
      size: 46 + Math.round(Math.random() * 42),
      x: event.clientX,
      y: event.clientY,
    }

    setSplashes((currentSplashes) => [...currentSplashes.slice(-9), splash])
    window.setTimeout(() => {
      setSplashes((currentSplashes) =>
        currentSplashes.filter((item) => item.id !== splash.id),
      )
    }, 760)
  }

  return (
    <div
      className={`site-shell theme-${themeMode}`}
      onPointerDown={handleShellPointerDown}
      onPointerMove={handleShellPointerMove}
    >
      <OceanBubbleField fieldRef={bubbleFieldRef} />
      <div aria-hidden="true" className="painted-tide-scene">
        <span className="painted-wash painted-wash-hero" />
        <span className="painted-wash painted-wash-shop" />
        <span className="painted-wash painted-wash-bundle" />
        <span className="painted-wash painted-wash-films" />
        <span className="painted-wash painted-wash-studio" />
        <span className="painted-stroke painted-stroke-one" />
        <span className="painted-stroke painted-stroke-two" />
        <span className="painted-stroke painted-stroke-three" />
      </div>

      <div aria-hidden="true" className="splash-layer">
        {splashes.map((splash) => (
          <span
            className="click-splash"
            key={splash.id}
            style={
              {
                '--splash-size': `${splash.size}px`,
                left: `${splash.x}px`,
                top: `${splash.y}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div aria-hidden="true" className="flight-layer">
        {flights.map((flight) => (
          <ProductVisual
            className="cart-flight"
            key={flight.id}
            media={productMediaByProduct[flight.product.id]?.[0]}
            product={flight.product}
            style={
              {
                '--flight-from-x': `${flight.fromX}px`,
                '--flight-from-y': `${flight.fromY}px`,
                '--flight-to-x': `${flight.toX}px`,
                '--flight-to-y': `${flight.toY}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      <header className="site-header">
        <a className="brand" href="#" aria-label="Home">
          <span aria-hidden="true" className="brand-mark">
            <img alt="" src={brandMark} />
          </span>
          <span>
            Saltwater
            <strong>Squish</strong>
          </span>
        </a>

        <nav aria-label="Primary navigation" className="primary-nav">
          <a href="#shop">
            <span aria-hidden="true" className="nav-icon nav-icon-shop"><Shell size={15} /></span>
            Shop
          </a>
          <a href="#studio">
            <span aria-hidden="true" className="nav-icon nav-icon-studio"><Turtle size={15} /></span>
            Studio
          </a>
          <a href="#films">
            <span aria-hidden="true" className="nav-icon nav-icon-films"><FishSymbol size={15} /></span>
            Films
          </a>
          <a aria-current={hashRoute === '#about' ? 'location' : undefined} href="#about">
            <span aria-hidden="true" className="nav-icon nav-icon-about"><Waves size={15} /></span>
            About
          </a>
        </nav>

        <div className="header-actions">
          <button
            aria-label={`Switch to ${themeMode === 'day' ? 'night' : 'day'} mode`}
            aria-pressed={themeMode === 'night'}
            className="theme-mode-toggle"
            data-mode={themeMode}
            onClick={() => setThemeMode((currentMode) => currentMode === 'day' ? 'night' : 'day')}
            title={`Switch to ${themeMode === 'day' ? 'night' : 'day'} mode`}
            type="button"
          >
            <span aria-hidden="true" className="theme-mode-icon theme-mode-icon-day">
              <Sun size={16} strokeWidth={2} />
            </span>
            <span aria-hidden="true" className="theme-mode-icon theme-mode-icon-night">
              <MoonStar size={15} strokeWidth={2} />
            </span>
          </button>
          <button
            aria-controls="mobile-nav"
            aria-expanded={mobileNavOpen}
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            className="icon-button menu-button"
            onClick={() => setMobileNavOpen((isOpen) => !isOpen)}
            title={mobileNavOpen ? 'Close menu' : 'Menu'}
            type="button"
          >
            {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <button
            aria-label={`Open cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
            className="cart-button"
            onClick={() => setCartOpen(true)}
            ref={cartButtonRef}
            title="Open cart"
            type="button"
          >
            <ShoppingBag size={18} />
            <span>Cart</span>
            <strong>{cartCount}</strong>
          </button>
        </div>

        <nav
          aria-label="Mobile navigation"
          className={`mobile-nav ${mobileNavOpen ? 'is-open' : ''}`}
          id="mobile-nav"
        >
          <a href="#shop" onClick={() => setMobileNavOpen(false)}>
            <span aria-hidden="true" className="nav-icon nav-icon-shop"><Shell size={15} /></span>
            Shop
          </a>
          <a href="#studio" onClick={() => setMobileNavOpen(false)}>
            <span aria-hidden="true" className="nav-icon nav-icon-studio"><Turtle size={15} /></span>
            Studio
          </a>
          <a href="#films" onClick={() => setMobileNavOpen(false)}>
            <span aria-hidden="true" className="nav-icon nav-icon-films"><FishSymbol size={15} /></span>
            Films
          </a>
          <a
            aria-current={hashRoute === '#about' ? 'location' : undefined}
            href="#about"
            onClick={() => setMobileNavOpen(false)}
          >
            <span aria-hidden="true" className="nav-icon nav-icon-about"><Waves size={15} /></span>
            About
          </a>
        </nav>
      </header>

      <main id="top">
        {isAdminRoute ? (
          <DropFilmAdmin
            films={dropFilms}
            onFilmsRefresh={loadDropFilms}
            onProductCategoriesChanged={handleProductCategoriesChanged}
            onProductCommerceChanged={handleProductCommerceChanged}
            onProductDeleted={handleProductDeleted}
            onProductMediaDeleted={handleProductMediaDeleted}
            onProductMediaReconciled={handleProductMediaReconciled}
            onProductMediaRefresh={loadProductMedia}
            onProductRenamed={handleProductRenamed}
            products={products}
            productMediaByProduct={productMediaByProduct}
          />
        ) : (
          <>
        <section className="hero-section">
          <picture>
            <source srcSet={heroImageWebp} type="image/webp" />
            <img
              alt="Coastal squishy toys on pale sand beside shallow turquoise water."
              className="hero-photo"
              decoding="sync"
              fetchPriority="high"
              height="810"
              loading="eager"
              src={heroImage}
              width="1440"
            />
          </picture>
          <div className="hero-tint" />
          <div aria-hidden="true" className="hero-story-lines">
            <span>Half Moon Bay</span>
            <span>California coast</span>
          </div>
          <div className="hero-content">
            <p className="eyebrow">
              <Waves size={17} />
              A Half Moon Bay tide tale
            </p>
            <h1 aria-label="Saltwater Squish">
              <KineticText lines={['Saltwater', 'Squish']} tone="lagoon" />
            </h1>
            <p className="hero-copy">
              Coastal fidgets to squeeze and gift.
            </p>
            <div className="hero-actions">
              <a className="button primary-button" href="#shop">
                Shop the shore
                <ArrowRight size={18} />
              </a>
            </div>
          </div>
          <div aria-hidden="true" className="hero-word-tide">
            <div className="hero-word-tide-track">
              <span>Wild</span><i>~</i><span>Wavy</span><i>~</i><span>Squishy</span><i>~</i>
              <span>Wild</span><i>~</i><span>Wavy</span><i>~</i><span>Squishy</span><i>~</i>
            </div>
          </div>
        </section>

        <div
          aria-hidden="true"
          className="shoreline-bridge shoreline-bridge-water-sand"
          data-shoreline
        />

        <section
          className="shop-section"
          data-media-status={productMediaStatus}
          data-shopify-status={shopifyStatus}
          id="shop"
          aria-labelledby="shop-title"
        >
          <div className="shop-heading">
            <div>
              <p className="eyebrow">
                <ShoppingBag size={16} />
                Shop
              </p>
              <h2 aria-label="Coastal squishies." id="shop-title">
                <KineticText lines={['Coastal squishies.']} />
              </h2>
            </div>
          </div>

          <div aria-label="Filter products by category" className="filter-row">
            {categoryFilters.map((category) => (
              <button
                aria-pressed={activeCategory === category}
                className="filter-chip"
                key={category}
                onClick={() => setActiveCategory(category)}
                type="button"
              >
                {category}
              </button>
            ))}
          </div>

          <div className="product-grid">
            {filteredProducts.map((product) => {
              const isPurchasable = Boolean(
                product.price !== null &&
                product.inventoryQuantity !== 0 &&
                (!product.shopifyVariantId || product.availableForSale !== false),
              )
              const buttonLabel = product.inventoryQuantity === 0 ||
                (product.shopifyVariantId && product.availableForSale === false)
                ? 'Sold out'
                : 'Add to cart'
              const inventoryCopy = typeof product.inventoryQuantity === 'number' &&
                product.inventoryQuantity > 0
                ? `only ${Math.floor(product.inventoryQuantity)} left`
                : null

              return (
                <article className="product-card" key={product.id}>
                  <ProductMediaGallery media={productMediaByProduct[product.id] ?? []} product={product} />
                  <div className="product-card-body">
                    <div className="product-meta">
                      <strong>
                        {product.price === null ? 'Price pending' : currency.format(product.price)}
                      </strong>
                    </div>
                    <h3>{product.name}</h3>
                    <button
                      aria-label={`${buttonLabel}: ${product.name}${inventoryCopy ? `, ${inventoryCopy}` : ''}`}
                      className="button product-button"
                      disabled={!isPurchasable}
                      onClick={(event) => addToCart(product, event)}
                      type="button"
                    >
                      <span className="product-button-action">
                        <Plus size={17} />
                        {buttonLabel}
                      </span>
                      {isPurchasable && inventoryCopy ? (
                        <span className="product-button-inventory">{inventoryCopy}</span>
                      ) : null}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <div
          aria-hidden="true"
          className="shoreline-bridge shoreline-bridge-sand-water"
          data-shoreline
        />

        <DropFilmsSection films={dropFilms} products={storefrontProducts} status={dropFilmsStatus} />

        <AboutSection />

        <div
          aria-hidden="true"
          className="shoreline-bridge shoreline-bridge-studio shoreline-bridge-water-sand"
          data-shoreline
        />
          </>
        )}
      </main>

      <footer className="site-footer">
        {!isAdminRoute ? <DeferredStudio reducedMotion={reducedMotion} /> : null}
        <div className="footer-bar">
          <div aria-hidden="true" className="footer-ocean-scene">
            <span className="footer-wave footer-wave-back" />
            <span className="footer-wave footer-wave-front" />
            <span className="footer-bubble footer-bubble-one" />
            <span className="footer-bubble footer-bubble-two" />
            <span className="footer-bubble footer-bubble-three" />
            <span className="footer-bubble footer-bubble-four" />
            <span className="footer-bubble footer-bubble-five" />
            <span className="footer-bubble footer-bubble-six" />
            <span className="footer-swimmer footer-swimmer-one">
              <img alt="" decoding="async" loading="lazy" src={reefFishCoral} />
            </span>
            <span className="footer-swimmer footer-swimmer-two">
              <img alt="" decoding="async" loading="lazy" src={reefFishAqua} />
            </span>
            <span className="footer-swimmer footer-swimmer-three is-reverse">
              <img alt="" decoding="async" loading="lazy" src={reefFishSun} />
            </span>
            <span className="footer-shark-family">
              <img
                alt=""
                className="footer-daddy-shark"
                decoding="async"
                loading="lazy"
                src={blueDaddyShark}
              />
              <img
                alt=""
                className="footer-mama-shark"
                decoding="async"
                loading="lazy"
                src={purpleMamaShark}
              />
              <img
                alt=""
                className="footer-baby-shark"
                decoding="async"
                loading="lazy"
                src={pinkShark}
              />
            </span>
            <span className="footer-swimmer footer-swimmer-five">
              <img alt="" decoding="async" loading="lazy" src={reefFishCoral} />
            </span>
          </div>
          <div className="footer-signoff">
            <span aria-hidden="true" className="footer-sun" />
            <strong>See you by the tide.</strong>
          </div>
          <nav aria-label="Footer navigation">
            <button onClick={() => setOpenPolicy('shipping')} type="button">
              <Package size={17} />Shipping
            </button>
            <button onClick={() => setOpenPolicy('returns')} type="button">
              <RotateCcw size={17} />Returns
            </button>
            <button onClick={() => setOpenPolicy('safety')} type="button">
              <ShieldCheck size={17} />Safety
            </button>
          </nav>
        </div>
      </footer>

      {openPolicy ? <PolicyModal kind={openPolicy} onClose={() => setOpenPolicy(null)} /> : null}

      {cartOpen ? (
        <>
          <button
            aria-label="Close cart"
            className="cart-backdrop"
            onClick={() => setCartOpen(false)}
            type="button"
          />
          <aside aria-label="Shopping cart" className="cart-drawer" data-no-splash>
            <div className="cart-drawer-header">
              <div>
                <p className="eyebrow">
                  <ShoppingBag size={16} />
                  Cart
                </p>
                <h2>Your cart</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setCartOpen(false)}
                title="Close cart"
                type="button"
              >
                <X size={19} />
              </button>
            </div>

            {cartItems.length === 0 ? (
              <div className="empty-cart">
                <span aria-hidden="true" />
                <h3>Your cart is empty.</h3>
              </div>
            ) : (
              <div className="cart-items">
                {cartItems.map(({ product, quantity }) => (
                  <div className="cart-item" key={product.id}>
                    <ProductVisual media={productMediaByProduct[product.id]?.[0]} product={product} />
                    <div>
                      <strong>{product.name}</strong>
                      <span>{currency.format(product.price ?? 0)} each</span>
                    </div>
                    <div className="quantity-controls">
                      <button
                        aria-label={`Remove one ${product.name}`}
                        onClick={() => updateCart(product.id, -1)}
                        type="button"
                      >
                        <Minus size={15} />
                      </button>
                      <span>{quantity}</span>
                      <button
                        aria-label={`Add one ${product.name}`}
                        onClick={() => updateCart(product.id, 1)}
                        type="button"
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="cart-summary">
              <div>
                <span>Subtotal</span>
                <strong>{currency.format(subtotal)}</strong>
              </div>
              {checkoutError ? <p className="checkout-error" role="alert">{checkoutError}</p> : null}
              <button
                className="button primary-button checkout-button"
                disabled={cartItems.length === 0 || isCheckingOut}
                onClick={() => void startShopifyCheckout()}
                type="button"
              >
                {isCheckingOut ? 'Opening checkout' : 'Shopify checkout'}
                <ArrowRight size={18} />
              </button>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  )
}

export default App
