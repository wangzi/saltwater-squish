const productMediaSuffixes = new Set([
  'alt',
  'alternate',
  'back',
  'clip',
  'detail',
  'details',
  'front',
  'hero',
  'image',
  'img',
  'left',
  'main',
  'media',
  'photo',
  'right',
  'shopify',
  'side',
  'thumb',
  'thumbnail',
  'vid',
  'video',
  'web',
])

const productNameConnectors = new Set(['and', 'for', 'of', 'the', 'with'])

export function productSkuNameFromFileName(fileName: string) {
  const fileSegment = fileName.split('/').pop() ?? fileName
  const stem = fileSegment
    .replace(/\.[^.]+$/, '')
    .replace(/^\d{10,}[-_\s]+/, '')
    .replace(/^(?:sku[-_\s]*)?[a-z]{2,6}[-_\s]*\d{2,6}[-_\s]+/i, '')
  const words = stem.split(/[\s._-]+/).filter(Boolean)

  while (words.length > 0) {
    const lastWord = words.at(-1)?.toLowerCase() ?? ''
    const isMediaIndex = /^\d{1,3}$/.test(lastWord)

    if (!productMediaSuffixes.has(lastWord) && !isMediaIndex) {
      break
    }

    words.pop()
  }

  return words
    .map((word, index) => {
      if (/^[A-Z0-9]{2,6}$/.test(word) || /^\d+$/.test(word)) {
        return word
      }

      const lowerWord = word.toLowerCase()

      if (index > 0 && productNameConnectors.has(lowerWord)) {
        return lowerWord
      }

      return `${lowerWord.charAt(0).toUpperCase()}${lowerWord.slice(1)}`
    })
    .join(' ')
    .trim()
}
