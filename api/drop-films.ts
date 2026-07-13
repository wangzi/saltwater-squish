import { list, type ListBlobResultBlob } from '@vercel/blob'

type ApiResponse = {
  json: (body: unknown) => void
  status: (code: number) => ApiResponse
}

type DropFilmMetadata = {
  durationSeconds?: number
  pathname: string
  title: string
}

const videoPathPattern = /\.(mp4|mov|webm)$/i

function titleFromPathname(pathname: string) {
  const fileName = pathname.split('/').pop() ?? 'drop-film'
  const withoutExtension = fileName.replace(/\.[^.]+$/, '')
  const withoutTimestamp = withoutExtension.replace(/^\d{10,}-/, '')

  return withoutTimestamp
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Drop film'
}

function isVideoBlob(blob: ListBlobResultBlob) {
  return videoPathPattern.test(blob.pathname)
}

async function readMetadata(url: string) {
  try {
    const response = await fetch(url, { cache: 'no-store' })

    if (!response.ok) {
      return null
    }

    const metadata = (await response.json()) as Partial<DropFilmMetadata>

    if (!metadata.pathname || !metadata.title) {
      return null
    }

    return {
      durationSeconds:
        typeof metadata.durationSeconds === 'number' ? metadata.durationSeconds : undefined,
      pathname: metadata.pathname,
      title: metadata.title,
    }
  } catch {
    return null
  }
}

export default async function handler(_request: unknown, response: ApiResponse) {
  try {
    const [filmResult, metadataResult] = await Promise.all([
      list({ limit: 100, prefix: 'drop-films/' }),
      list({ limit: 100, prefix: 'drop-film-metadata/' }),
    ])

    const metadataEntries = await Promise.all(
      metadataResult.blobs.map((blob) => readMetadata(blob.url)),
    )
    const metadataByPathname = new Map<string, DropFilmMetadata>()

    metadataEntries.forEach((metadata) => {
      if (metadata) {
        metadataByPathname.set(metadata.pathname, metadata)
      }
    })

    const films = filmResult.blobs
      .filter(isVideoBlob)
      .sort((left, right) => right.uploadedAt.getTime() - left.uploadedAt.getTime())
      .map((blob) => {
        const metadata = metadataByPathname.get(blob.pathname)

        return {
          downloadUrl: blob.downloadUrl,
          durationSeconds: metadata?.durationSeconds,
          id: blob.pathname,
          pathname: blob.pathname,
          size: blob.size,
          title: metadata?.title ?? titleFromPathname(blob.pathname),
          uploadedAt: blob.uploadedAt.toISOString(),
          url: blob.url,
        }
      })

    return response.status(200).json({ films, source: 'blob' })
  } catch (error) {
    console.warn('Drop films unavailable', error)
    return response.status(200).json({ films: [], source: 'unavailable' })
  }
}
