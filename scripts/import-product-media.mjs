import { spawn } from 'node:child_process'
import { mkdir, readFile, stat } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { list, put } from '@vercel/blob'

const products = [
  {
    files: ['blue coconut oil ball.jpeg'],
    id: 'blue-coconut-oil-ball',
    name: 'Blue Coconut Oil Ball',
    sku: 'SWS-COB-BLU',
    sortOrder: 10,
  },
  {
    files: ['pink coconut oil ball1.jpeg', 'pink cocnut oil ball2.jpeg', 'cocnut oil vid.mov'],
    id: 'pink-coconut-oil-ball',
    name: 'Pink Coconut Oil Ball',
    sku: 'SWS-COB-PNK',
    sortOrder: 20,
  },
  {
    files: [' blue crunchy bead ball.jpeg'],
    id: 'blue-crunchy-bead-ball',
    name: 'Blue Crunchy Bead Ball',
    sku: 'SWS-CBB-BLU',
    sortOrder: 30,
  },
  {
    files: ['pink crunchy bead ball.jpeg', 'crunchy 1.mov', 'crunchy 2.mov'],
    id: 'pink-crunchy-bead-ball',
    name: 'Pink Crunchy Bead Ball',
    sku: 'SWS-CBB-PNK',
    sortOrder: 40,
  },
  {
    files: ['jumbo transparent vaseline cheese.jpeg', 'jumbo clear cheese .mov'],
    id: 'jumbo-transparent-vaseline-cheese',
    name: 'Jumbo Transparent Vaseline Cheese',
    sku: 'SWS-VC-JMB',
    sortOrder: 50,
  },
  {
    files: ['mini vaseline cheese.jpeg', 'mini vaseline cheese vid.mov'],
    id: 'mini-vaseline-cheese',
    name: 'Mini Vaseline Cheese',
    sku: 'SWS-VC-MIN',
    sortOrder: 60,
  },
  {
    files: ['peach sluchy ball.jpeg', 'peach slushy.mov'],
    id: 'peach-slushy-ball',
    name: 'Peach Slushy Ball',
    sku: 'SWS-SLB-PCH',
    sortOrder: 70,
  },
  {
    files: ['pillow taba squishy.jpeg', 'pillow taba 2.jpeg', 'pillow taba vid.mov'],
    id: 'pillow-taba-squishy',
    name: 'Pillow Taba Squishy',
    sku: 'SWS-TAB-WHT',
    sortOrder: 80,
  },
  {
    files: ['pink slow rise bun .jpeg', 'pink sticky bun vid.mov'],
    id: 'pink-slow-rise-bun',
    name: 'Pink Slow Rise Bun',
    sku: 'SWS-SRB-PNK',
    sortOrder: 90,
  },
  {
    files: ['soymilk slow rise bun.jpeg', 'soymilk sloow rise vid.mov'],
    id: 'soymilk-slow-rise-bun',
    name: 'Soymilk Slow Rise Bun',
    sku: 'SWS-SRB-SOY',
    sortOrder: 100,
  },
  {
    files: ['slow rise soap.jpeg', 'ss soap vid.mov'],
    id: 'slow-rise-soap',
    name: 'Slow Rise Soap',
    sku: 'SWS-SOAP-WHT',
    sortOrder: 110,
  },
  {
    files: ['watermelon slushy ball.jpeg', 'watermelon slushy ball vid.mov'],
    id: 'watermelon-slushy-ball',
    name: 'Watermelon Slushy Ball',
    sku: 'SWS-SLB-WML',
    sortOrder: 120,
  },
  {
    files: ['Photo Jul 03 2026, 10 49 53 AM.jpeg', 'Photo Jul 03 2026, 10 58 23 AM.jpeg'],
    id: 'chiboki-toothpaste-squishy',
    name: 'Chiboki Toothpaste Squishy',
    sku: 'SWS-CHB-WHT',
    sortOrder: 130,
  },
]

const sourceDirectory = process.argv[2] ? resolve(process.argv[2]) : ''
const cacheDirectory = join(tmpdir(), 'saltwater-squish-product-import')

if (!sourceDirectory) {
  throw new Error('Usage: npm run import:products -- "/absolute/path/to/media"')
}

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  throw new Error('BLOB_READ_WRITE_TOKEN is required. Load .env.local before running the importer.')
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function isVideo(fileName) {
  return /\.(mov|mp4|webm)$/i.test(fileName)
}

function run(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'inherit'] })

    child.on('error', rejectPromise)
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise()
      } else {
        rejectPromise(new Error(`${command} exited with status ${code}`))
      }
    })
  })
}

async function optimizedFileFor(productId, fileName, index) {
  const sourcePath = join(sourceDirectory, fileName)
  const sourceStats = await stat(sourcePath)
  const outputExtension = isVideo(fileName) ? '.mp4' : '.jpg'
  const outputPath = join(cacheDirectory, `${productId}-${index}${outputExtension}`)
  const outputStats = await stat(outputPath).catch(() => null)

  if (outputStats && outputStats.mtimeMs >= sourceStats.mtimeMs) {
    return outputPath
  }

  if (isVideo(fileName)) {
    await run('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-i',
      sourcePath,
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      '-vf',
      "scale='min(1280,iw)':-2:flags=lanczos,format=yuv420p",
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      outputPath,
    ])
  } else {
    await run('sips', [
      '-s',
      'format',
      'jpeg',
      '-s',
      'formatOptions',
      '82',
      '-Z',
      '1600',
      sourcePath,
      '--out',
      outputPath,
    ])
  }

  return outputPath
}

async function readExistingMetadata(productId) {
  const pathname = `product-media-metadata/${productId}.json`
  const result = await list({ limit: 1, prefix: pathname })
  const blob = result.blobs.find((item) => item.pathname === pathname)

  if (!blob) {
    return { assets: [] }
  }

  const response = await fetch(`${blob.url}?catalog-refresh=${Date.now()}`, { cache: 'no-store' })
  return response.ok ? response.json() : { assets: [] }
}

async function importProduct(product) {
  const existingMetadata = await readExistingMetadata(product.id)
  const existingAssets = Array.isArray(existingMetadata.assets) ? existingMetadata.assets : []
  const hostedResult = await list({ limit: 100, prefix: `product-media/${product.id}/` })
  const nextAssets = []

  console.log(`\n${product.sku}  ${product.name}`)

  for (const [index, fileName] of product.files.entries()) {
    const existingAsset = existingAssets.find((asset) => asset.sourceFile === fileName)
    const fileSlug = slugify(basename(fileName, extname(fileName)))
    const expectedExtension = isVideo(fileName) ? '.mp4' : '.jpg'
    const hostedAsset = hostedResult.blobs
      .filter((blob) => blob.pathname.includes(`-${fileSlug}-`) && blob.pathname.endsWith(expectedExtension))
      .sort((left, right) => right.uploadedAt.getTime() - left.uploadedAt.getTime())[0]

    if (existingAsset) {
      nextAssets.push({ ...existingAsset, sortOrder: index })
      console.log(`  reuse   ${fileName}`)
      continue
    }

    if (hostedAsset) {
      nextAssets.push({
        contentType: isVideo(fileName) ? 'video/mp4' : 'image/jpeg',
        downloadUrl: hostedAsset.downloadUrl,
        id: hostedAsset.pathname,
        kind: isVideo(fileName) ? 'video' : 'image',
        pathname: hostedAsset.pathname,
        productId: product.id,
        size: hostedAsset.size,
        sortOrder: index,
        sourceFile: fileName,
        skuName: product.name,
        title: basename(fileName, extname(fileName)).trim(),
        uploadedAt: hostedAsset.uploadedAt.toISOString(),
        url: hostedAsset.url,
      })
      console.log(`  recover ${fileName}`)
      continue
    }

    console.log(`  prepare ${fileName}`)
    const optimizedPath = await optimizedFileFor(product.id, fileName, index)
    const optimizedStats = await stat(optimizedPath)
    const video = isVideo(fileName)
    const contentType = video ? 'video/mp4' : 'image/jpeg'
    const extension = video ? 'mp4' : 'jpg'
    const pathname = `product-media/${product.id}/${Date.now()}-${slugify(basename(fileName, extname(fileName)))}.${extension}`
    const blob = await put(pathname, await readFile(optimizedPath), {
      access: 'public',
      addRandomSuffix: true,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
      contentType,
    })

    nextAssets.push({
      contentType,
      downloadUrl: blob.downloadUrl,
      id: blob.pathname,
      kind: video ? 'video' : 'image',
      pathname: blob.pathname,
      productId: product.id,
      size: optimizedStats.size,
      sortOrder: index,
      sourceFile: fileName,
      skuName: product.name,
      title: basename(fileName, extname(fileName)).trim(),
      uploadedAt: new Date().toISOString(),
      url: blob.url,
    })
    console.log(`  upload  ${fileName} (${Math.round(optimizedStats.size / 1024)} KB)`)
  }

  const importedSourceFiles = new Set(product.files)
  const preservedAssets = existingAssets.filter(
    (asset) => !asset.sourceFile || !importedSourceFiles.has(asset.sourceFile),
  )
  const metadata = {
    assets: [...nextAssets, ...preservedAssets],
    product: {
      id: product.id,
      name: product.name,
      price: null,
      sku: product.sku,
      sortOrder: product.sortOrder,
      status: 'published',
    },
    productId: product.id,
    updatedAt: new Date().toISOString(),
  }

  await put(`product-media-metadata/${product.id}.json`, JSON.stringify(metadata), {
    access: 'public',
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: 'application/json',
  })

  return nextAssets.length
}

await mkdir(cacheDirectory, { recursive: true })

let importedFiles = 0
for (const product of products) {
  importedFiles += await importProduct(product)
}

console.log(`\nCatalog ready: ${products.length} SKUs and ${importedFiles} organized media files.`)
