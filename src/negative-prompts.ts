/** Smart negative prompt generation per image type and style. */

export const UNIVERSAL_NEGATIVES: readonly string[] = [
  'ugly',
  'blurry',
  'low quality',
  'deformed',
  'distorted',
  'watermark',
  'text overlay',
  'signature',
  'noisy',
  'artifact',
  'oversaturated',
  'overexposed',
  'underexposed',
  'bad anatomy',
  'out of focus',
  'pixelated',
  'jpeg artifacts',
  'compression artifacts',
];

export const TYPE_NEGATIVES: Readonly<Record<string, readonly string[]>> = {
  ICON: ['complex background', 'text', 'busy design', 'multiple subjects', 'photorealistic', 'photograph'],
  THUMBNAIL: ['blurry subject', 'empty composition', 'no focal point', 'dark and muddy'],
  BACKGROUND: ['text', 'logo', 'subject in foreground', 'busy cluttered design', 'distracting elements'],
  TEXTURE: ['non-seamless edges', 'visible seams', 'irregular pattern', 'blurry texture'],
  AVATAR: ['distorted face', 'multiple people', 'bad teeth', 'weird eyes', 'body horror', 'missing face'],
  CONTENT: ['cluttered composition', 'confusing layout', 'unrelated elements', 'busy background'],
  BANNER: ['vertical orientation', 'portrait format', 'text heavy', 'dark and muddy colors'],
  PRODUCT: ['messy background', 'other products in frame', 'hands holding', 'dark shadows obscuring product'],
  LOGO: ['text', 'overly complex details', 'photograph', 'gradient only', 'raster effects'],
  HERO: ['people faces prominent', 'small scale elements', 'dark and dingy', 'low resolution look'],
  FEATURED: ['amateur photo quality', 'snapshot style', 'poor lighting', 'unfocused blur'],
};

export const STYLE_NEGATIVES: Readonly<Record<string, readonly string[]>> = {
  photorealistic: ['cartoon', 'anime', 'illustration', 'painted', 'sketch', 'drawing', 'unrealistic'],
  illustration: ['photograph', 'photorealistic', '3d render', 'noisy photograph'],
  watercolor: ['sharp edges', 'digital look', 'hard lines', 'precise detail', 'photorealistic'],
  oil_painting: ['digital art look', 'flat design', 'vector style', 'photograph'],
  digital_art: ['photographic noise', 'film grain', 'imprecise lines'],
  vector: ['photorealistic', 'organic textures', 'photograph', 'painterly', 'noisy'],
  pixel_art: ['smooth gradients', 'high resolution blur', 'antialiased edges'],
  sketch: ['colored painting', 'photorealistic', 'digital painting'],
  '3d_render': ['flat illustration', 'hand-drawn', 'sketch style', '2d flat design'],
  anime: ['photorealistic', 'western cartoon', 'realistic photograph'],
  cinematic: ['flat lighting', 'amateur photograph', 'snapshot quality'],
  minimalist: ['cluttered', 'complex detail', 'busy design', 'pattern heavy'],
  comic: ['photorealistic', 'painterly', 'sketch without inks', 'watercolor'],
  vintage: ['modern clean design', 'digital look', 'high saturation', 'sharp digital'],
  abstract: ['representational art', 'realistic', 'figurative', 'literal depiction'],
};

/**
 * Build a negative prompt for the given type/style combination.
 *
 * Combines universal negatives, type-specific negatives, style-specific negatives,
 * and any custom negatives. Deduplicates while preserving order.
 */
export function buildNegativePrompt(
  imageType: string,
  style?: string,
  customNegative?: string,
): string {
  const parts: string[] = [...UNIVERSAL_NEGATIVES];

  const typeNegs = TYPE_NEGATIVES[imageType.toUpperCase()] ?? [];
  parts.push(...typeNegs);

  if (style) {
    const styleNegs = STYLE_NEGATIVES[style.toLowerCase()] ?? [];
    parts.push(...styleNegs);
  }

  if (customNegative) {
    const customParts = customNegative.split(',').map(p => p.trim()).filter(Boolean);
    parts.push(...customParts);
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const part of parts) {
    const normalized = part.toLowerCase().trim();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(part);
    }
  }

  return unique.join(', ');
}
