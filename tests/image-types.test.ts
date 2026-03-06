import { describe, it, expect } from 'vitest';
import { IMAGE_TYPE_DEFAULTS } from '../src/image-types.js';

const ALL_IMAGE_TYPES = [
  'ICON', 'THUMBNAIL', 'BACKGROUND', 'TEXTURE',
  'AVATAR', 'CONTENT', 'BANNER', 'PRODUCT',
  'LOGO', 'HERO', 'FEATURED',
];

describe('IMAGE_TYPE_DEFAULTS', () => {
  it('has all 11 image types', () => {
    expect(Object.keys(IMAGE_TYPE_DEFAULTS).sort()).toEqual(ALL_IMAGE_TYPES.sort());
  });

  it('every type has valid dimensions (positive, multiples of 8)', () => {
    for (const [name, cfg] of Object.entries(IMAGE_TYPE_DEFAULTS)) {
      expect(cfg.width % 8, `${name}.width`).toBe(0);
      expect(cfg.height % 8, `${name}.height`).toBe(0);
      expect(cfg.width, `${name}.width`).toBeGreaterThan(0);
      expect(cfg.height, `${name}.height`).toBeGreaterThan(0);
    }
  });

  it('every type has all required default fields', () => {
    for (const [name, cfg] of Object.entries(IMAGE_TYPE_DEFAULTS)) {
      expect(cfg.defaultStyle, `${name}.defaultStyle`).toBeTruthy();
      expect(cfg.defaultMood, `${name}.defaultMood`).toBeTruthy();
      expect(cfg.defaultComposition, `${name}.defaultComposition`).toBeTruthy();
      expect(cfg.defaultLighting, `${name}.defaultLighting`).toBeTruthy();
    }
  });
});

describe('Config without config file', () => {
  it('has empty models when no config file exists', async () => {
    const { loadConfig } = await import('../src/config.js');
    const cfg = loadConfig({}, '/nonexistent/path.json');
    expect(Object.keys(cfg.models).length).toBe(0);
  });

  it('has empty imageTypes when no config file exists', async () => {
    const { loadConfig } = await import('../src/config.js');
    const cfg = loadConfig({}, '/nonexistent/path.json');
    expect(Object.keys(cfg.imageTypes).length).toBe(0);
  });
});
