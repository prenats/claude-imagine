/** Image type definitions and configuration for generation. */

import type { Style, Mood, Composition, Lighting } from './models.js';

export interface ImageTypeDefaults {
  readonly width: number;
  readonly height: number;
  readonly defaultStyle: Style;
  readonly defaultMood: Mood;
  readonly defaultComposition: Composition;
  readonly defaultLighting: Lighting;
}

export const IMAGE_TYPE_DEFAULTS: Readonly<Record<string, ImageTypeDefaults>> = {
  ICON: {
    width: 512,
    height: 512,
    defaultStyle: 'vector',
    defaultMood: 'professional',
    defaultComposition: 'centered',
    defaultLighting: 'studio',
  },
  THUMBNAIL: {
    width: 768,
    height: 432,
    defaultStyle: 'digital_art',
    defaultMood: 'energetic',
    defaultComposition: 'rule_of_thirds',
    defaultLighting: 'natural',
  },
  BACKGROUND: {
    width: 1344,
    height: 768,
    defaultStyle: 'digital_art',
    defaultMood: 'calm',
    defaultComposition: 'panoramic',
    defaultLighting: 'ambient',
  },
  TEXTURE: {
    width: 1024,
    height: 1024,
    defaultStyle: 'photorealistic',
    defaultMood: 'professional',
    defaultComposition: 'centered',
    defaultLighting: 'studio',
  },
  AVATAR: {
    width: 768,
    height: 768,
    defaultStyle: 'photorealistic',
    defaultMood: 'professional',
    defaultComposition: 'close_up',
    defaultLighting: 'soft',
  },
  CONTENT: {
    width: 1024,
    height: 768,
    defaultStyle: 'illustration',
    defaultMood: 'professional',
    defaultComposition: 'rule_of_thirds',
    defaultLighting: 'natural',
  },
  BANNER: {
    width: 1344,
    height: 384,
    defaultStyle: 'cinematic',
    defaultMood: 'dramatic',
    defaultComposition: 'panoramic',
    defaultLighting: 'dramatic',
  },
  PRODUCT: {
    width: 896,
    height: 1152,
    defaultStyle: 'photorealistic',
    defaultMood: 'professional',
    defaultComposition: 'centered',
    defaultLighting: 'studio',
  },
  LOGO: {
    width: 1024,
    height: 1024,
    defaultStyle: 'vector',
    defaultMood: 'professional',
    defaultComposition: 'centered',
    defaultLighting: 'studio',
  },
  HERO: {
    width: 1344,
    height: 768,
    defaultStyle: 'cinematic',
    defaultMood: 'dramatic',
    defaultComposition: 'wide_angle',
    defaultLighting: 'golden_hour',
  },
  FEATURED: {
    width: 1024,
    height: 1024,
    defaultStyle: 'photorealistic',
    defaultMood: 'elegant',
    defaultComposition: 'rule_of_thirds',
    defaultLighting: 'natural',
  },
};
