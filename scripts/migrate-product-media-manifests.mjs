import {
  listLatestProductManifests,
  writeProductManifest,
} from './product-media-manifests.mjs'

const dryRun = process.argv.includes('--dry-run')
const manifests = await listLatestProductManifests()
let migrated = 0
let skipped = 0

for (const { manifest } of manifests) {
  if (manifest.revision) {
    skipped += 1
    continue
  }

  if (!dryRun) {
    await writeProductManifest(manifest.productId, {
      assets: Array.isArray(manifest.assets) ? manifest.assets : [],
      ...(manifest.deletedAt ? { deletedAt: manifest.deletedAt } : {}),
      ...(manifest.product ? { product: manifest.product } : {}),
    })
  }

  migrated += 1
}

console.log(JSON.stringify({ dryRun, migrated, skipped, total: manifests.length }, null, 2))
