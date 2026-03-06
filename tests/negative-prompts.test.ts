import { describe, it, expect } from 'vitest';
import {
  UNIVERSAL_NEGATIVES,
  TYPE_NEGATIVES,
  STYLE_NEGATIVES,
  buildNegativePrompt,
} from '../src/negative-prompts.js';
import { IMAGE_TYPE_DEFAULTS } from '../src/image-types.js';
import { Style } from '../src/models.js';

const ALL_IMAGE_TYPES = Object.keys(IMAGE_TYPE_DEFAULTS);
const ALL_STYLES = Object.values(Style) as string[];

describe('UNIVERSAL_NEGATIVES', () => {
  it('is not empty', () => {
    expect(UNIVERSAL_NEGATIVES.length).toBeGreaterThan(0);
  });

  it('contains common negative terms', () => {
    const joined = UNIVERSAL_NEGATIVES.join(' ').toLowerCase();
    expect(joined).toContain('blurry');
    expect(joined).toContain('ugly');
    expect(joined).toContain('low quality');
  });
});

describe('TYPE_NEGATIVES', () => {
  it('covers all image types', () => {
    for (const imageType of ALL_IMAGE_TYPES) {
      expect(TYPE_NEGATIVES).toHaveProperty(imageType);
    }
  });

  it('has non-empty negatives for each type', () => {
    for (const [imageType, negs] of Object.entries(TYPE_NEGATIVES)) {
      expect(negs.length, `Empty negatives for type '${imageType}'`).toBeGreaterThan(0);
    }
  });
});

describe('STYLE_NEGATIVES', () => {
  it('covers all styles', () => {
    for (const style of ALL_STYLES) {
      expect(STYLE_NEGATIVES, `Missing style negatives for: ${style}`).toHaveProperty(style);
    }
  });

  it('has non-empty negatives for each style', () => {
    for (const [style, negs] of Object.entries(STYLE_NEGATIVES)) {
      expect(negs.length, `Empty negatives for style '${style}'`).toBeGreaterThan(0);
    }
  });
});

describe('buildNegativePrompt', () => {
  it('returns a non-empty string', () => {
    const result = buildNegativePrompt('ICON');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes universal negatives', () => {
    const result = buildNegativePrompt('HERO');
    expect(result).toContain('ugly');
    expect(result).toContain('blurry');
  });

  it('includes type-specific negatives', () => {
    const result = buildNegativePrompt('ICON');
    const parts = result.split(', ');
    expect(
      parts.some(p => p.toLowerCase().includes('text') || p.toLowerCase().includes('complex background')),
    ).toBe(true);
  });

  it('includes style-specific negatives', () => {
    const result = buildNegativePrompt('HERO', 'photorealistic');
    const parts = result.split(', ');
    expect(
      parts.some(p => p.toLowerCase().includes('cartoon') || p.toLowerCase().includes('anime')),
    ).toBe(true);
  });

  it('appends custom negatives', () => {
    const result = buildNegativePrompt('ICON', undefined, 'red background, purple');
    expect(result).toContain('red background');
    expect(result).toContain('purple');
  });

  it('deduplicates results', () => {
    const result = buildNegativePrompt('ICON', 'vector', 'ugly, blurry');
    const parts = result.split(', ').map(p => p.trim().toLowerCase());
    expect(parts.length).toBe(new Set(parts).size);
  });

  it('handles undefined style gracefully', () => {
    const result = buildNegativePrompt('AVATAR', undefined);
    expect(typeof result).toBe('string');
    expect(result).toContain('ugly');
  });

  it('handles unknown image type gracefully (falls back to universal negatives)', () => {
    const result = buildNegativePrompt('UNKNOWN_TYPE');
    expect(result).toContain('ugly');
  });

  it('handles unknown style gracefully', () => {
    const result = buildNegativePrompt('HERO', 'nonexistent_style');
    expect(result).toContain('ugly');
  });

  it('produces comma-separated output with no empty parts', () => {
    const result = buildNegativePrompt('PRODUCT');
    const parts = result.split(', ');
    expect(parts.every(p => p.trim().length > 0)).toBe(true);
  });

  it('handles all type+style combinations without error', () => {
    for (const imageType of ALL_IMAGE_TYPES) {
      for (const style of ALL_STYLES) {
        const result = buildNegativePrompt(imageType, style);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      }
    }
  });
});
