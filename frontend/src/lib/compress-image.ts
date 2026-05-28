import imageCompression from 'browser-image-compression'

const ONE_MB = 1_048_576

export interface CompressOptions {
  /** Max long edge in pixels after compression. Default 1920. */
  maxLongEdgePx?: number
  /** Initial JPEG quality 0-1. Default 0.85. */
  quality?: number
  /** Files at or below this size in bytes are returned unchanged. Default 1 MB. */
  passThroughBelowBytes?: number
  /** Upper bound on output size after compression. Default 4 MB (under the 5 MB backend ceiling). */
  maxOutputMB?: number
}

const HEIC_TYPES = new Set(['image/heic', 'image/heif'])

function swapHeicExtension(name: string): string {
  return name.replace(/\.(heic|heif)$/i, '.jpg')
}

/**
 * Adaptive client-side image compression. Files already smaller than the
 * passthrough threshold are returned untouched. HEIC/HEIF files are always
 * transcoded to JPEG so they're consumable by every server path.
 *
 * Failures fall back to the original file rather than blocking the upload —
 * the backend's 5 MB validator remains the last line of defense.
 */
export async function compressImage(
  file: File,
  opts: CompressOptions = {}
): Promise<File> {
  const {
    maxLongEdgePx = 1920,
    quality = 0.85,
    passThroughBelowBytes = ONE_MB,
    maxOutputMB = 4,
  } = opts

  const isHeic = HEIC_TYPES.has(file.type)

  if (!isHeic && file.size <= passThroughBelowBytes) {
    return file
  }

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: maxOutputMB,
      maxWidthOrHeight: maxLongEdgePx,
      initialQuality: quality,
      useWebWorker: true,
      fileType: isHeic ? 'image/jpeg' : file.type,
    })

    const outputName = isHeic ? swapHeicExtension(file.name) : file.name
    if (compressed.name !== outputName) {
      return new File([compressed], outputName, {
        type: compressed.type,
        lastModified: Date.now(),
      })
    }
    return compressed as File
  } catch {
    return file
  }
}

/** Preset for documents where legibility matters (e.g. Driver's License). */
export function compressDocument(file: File): Promise<File> {
  return compressImage(file, { maxLongEdgePx: 2400, quality: 0.9 })
}
