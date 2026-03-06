/**
 * Data models and enums for image generation.
 * Uses `as const` objects + union types instead of Python Enum classes.
 */

/** A model definition stored in config — backend-agnostic. */
export interface ModelDefinition {
  readonly id: string;
  readonly filename: string;
  readonly displayName: string;
  readonly type: 'checkpoint' | 'unet';
  readonly params: Readonly<Record<string, unknown>>;
  readonly tier?: 'fast' | 'standard' | 'high';
}

export const Style = {
  PHOTOREALISTIC: 'photorealistic',
  ILLUSTRATION: 'illustration',
  WATERCOLOR: 'watercolor',
  OIL_PAINTING: 'oil_painting',
  DIGITAL_ART: 'digital_art',
  VECTOR: 'vector',
  PIXEL_ART: 'pixel_art',
  SKETCH: 'sketch',
  THREE_D_RENDER: '3d_render',
  ANIME: 'anime',
  CINEMATIC: 'cinematic',
  MINIMALIST: 'minimalist',
  COMIC: 'comic',
  VINTAGE: 'vintage',
  ABSTRACT: 'abstract',
} as const;
export type Style = (typeof Style)[keyof typeof Style];

export const Mood = {
  ENERGETIC: 'energetic',
  CALM: 'calm',
  DRAMATIC: 'dramatic',
  PLAYFUL: 'playful',
  MYSTERIOUS: 'mysterious',
  ELEGANT: 'elegant',
  WARM: 'warm',
  COOL: 'cool',
  PROFESSIONAL: 'professional',
  WHIMSICAL: 'whimsical',
  DARK: 'dark',
  BRIGHT: 'bright',
} as const;
export type Mood = (typeof Mood)[keyof typeof Mood];

export const Composition = {
  CENTERED: 'centered',
  RULE_OF_THIRDS: 'rule_of_thirds',
  SYMMETRICAL: 'symmetrical',
  DIAGONAL: 'diagonal',
  FRAMING: 'framing',
  LEADING_LINES: 'leading_lines',
  CLOSE_UP: 'close_up',
  WIDE_ANGLE: 'wide_angle',
  BIRDS_EYE: 'birds_eye',
  LOW_ANGLE: 'low_angle',
  PANORAMIC: 'panoramic',
  NEGATIVE_SPACE: 'negative_space',
} as const;
export type Composition = (typeof Composition)[keyof typeof Composition];

export const Lighting = {
  NATURAL: 'natural',
  STUDIO: 'studio',
  DRAMATIC: 'dramatic',
  SOFT: 'soft',
  GOLDEN_HOUR: 'golden_hour',
  NEON: 'neon',
  BACKLIT: 'backlit',
  RIMLIGHT: 'rimlight',
  AMBIENT: 'ambient',
  HIGH_KEY: 'high_key',
  LOW_KEY: 'low_key',
  VOLUMETRIC: 'volumetric',
} as const;
export type Lighting = (typeof Lighting)[keyof typeof Lighting];

/** All parameters for a generation request — immutable via readonly. */
export interface GenerationRequest {
  readonly imageType: string;
  readonly description: string;
  readonly outputPath: string;
  readonly style?: string;
  readonly mood?: string;
  readonly colorPalette?: string;
  readonly composition?: string;
  readonly lighting?: string;
  readonly negativePrompt?: string;
  readonly model?: string;
  readonly quality?: string;
  readonly width?: number;
  readonly height?: number;
  readonly seed?: number;
}

/** The result of prompt building — ready for workflow dispatch. */
export interface BuiltPrompt {
  readonly positive: string;
  readonly negative: string;
  readonly model: string;
  readonly width: number;
  readonly height: number;
  readonly seed: number;
}
