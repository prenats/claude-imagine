/** claude-imagine — MCP image generation server. */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ConnectionError, GenerationError, TimeoutError } from './errors.js';
import { CONFIG } from './config.js';
import { generateSingle } from './generate.js';
import { IMAGE_TYPE_DEFAULTS } from './image-types.js';
import { Style, Mood, Composition, Lighting } from './models.js';

// Register backends
import './backends/comfyui/index.js';

import { getBackend } from './backends/registry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const backend = getBackend(CONFIG.backend);
if (!backend) {
  throw new Error(`Backend '${CONFIG.backend}' not found. Registered backends must be imported before use.`);
}

const server = new McpServer({
  name: 'claude-imagine',
  version: pkg.version,
});

// Build dynamic model description from config
const modelIds = Object.keys(CONFIG.models);
const modelDescription = modelIds.length > 0
  ? `Force a specific model — ${modelIds.join(', ')}`
  : 'No models configured. Run ./install.sh to discover models.';

// ─────────────────────────────────────────────────────────────────────────────
// Tool: generate_image
// ─────────────────────────────────────────────────────────────────────────────

server.registerTool(
  'generate_image',
  {
    description: [
      'Generate an image and save it to disk.',
      '',
      'Args:',
      '  image_type: ICON, THUMBNAIL, BACKGROUND, TEXTURE, AVATAR, CONTENT,',
      '              BANNER, PRODUCT, LOGO, HERO, or FEATURED.',
      '  description: What the image should depict. Be specific and descriptive.',
      '  output_path: Where to save the PNG file (relative or absolute path). Defaults to generated/<slug>.png.',
      '  style: photorealistic, illustration, watercolor, oil_painting, digital_art,',
      '         vector, pixel_art, sketch, 3d_render, anime, cinematic,',
      '         minimalist, comic, vintage, abstract. Defaults to type-appropriate style.',
      '  mood: energetic, calm, dramatic, playful, mysterious, elegant,',
      '        warm, cool, professional, whimsical, dark, bright.',
      '  color_palette: warm, cool, monochrome, pastel, vibrant, earth_tones, neon, dark.',
      '  composition: centered, rule_of_thirds, symmetrical, diagonal, framing,',
      '               leading_lines, close_up, wide_angle, birds_eye, low_angle,',
      '               panoramic, negative_space.',
      '  lighting: natural, studio, dramatic, soft, golden_hour, neon, backlit,',
      '            rimlight, ambient, high_key, low_key, volumetric.',
      '  negative_prompt: Custom negative terms to avoid (SDXL only, comma-separated).',
      `  model: ${modelDescription}.`,
      '  quality: fast, standard, or high. Overrides model selection.',
      '  width: Override width (max 1536, rounded to multiple of 8).',
      '  height: Override height (max 1536, rounded to multiple of 8).',
      '  seed: For reproducibility. Random if not set.',
    ].join('\n'),
    inputSchema: {
      image_type: z.string().describe('ICON, THUMBNAIL, BACKGROUND, TEXTURE, AVATAR, CONTENT, BANNER, PRODUCT, LOGO, HERO, or FEATURED'),
      description: z.string().describe('What the image should depict. Be specific and descriptive.'),
      output_path: z.string().optional().describe('Where to save the PNG file (relative or absolute path). Defaults to generated/<slug>.png'),
      style: z.string().optional().describe('Visual style — photorealistic, illustration, watercolor, oil_painting, digital_art, vector, pixel_art, sketch, 3d_render, anime, cinematic, minimalist, comic, vintage, abstract'),
      mood: z.string().optional().describe('Emotional tone — energetic, calm, dramatic, playful, mysterious, elegant, warm, cool, professional, whimsical, dark, bright'),
      color_palette: z.string().optional().describe('warm, cool, monochrome, pastel, vibrant, earth_tones, neon, dark'),
      composition: z.string().optional().describe('centered, rule_of_thirds, symmetrical, diagonal, framing, leading_lines, close_up, wide_angle, birds_eye, low_angle, panoramic, negative_space'),
      lighting: z.string().optional().describe('natural, studio, dramatic, soft, golden_hour, neon, backlit, rimlight, ambient, high_key, low_key, volumetric'),
      negative_prompt: z.string().optional().describe('Custom negative terms to avoid (SDXL only, comma-separated)'),
      model: z.string().optional().describe(modelDescription),
      quality: z.string().optional().describe('fast, standard, or high'),
      width: z.number().int().positive().optional().describe('Override width (max 1536, rounded to multiple of 8)'),
      height: z.number().int().positive().optional().describe('Override height (max 1536, rounded to multiple of 8)'),
      seed: z.number().int().nonnegative().optional().describe('For reproducibility. Random if not set.'),
    },
  },
  async (params) => {
    try {
      const result = await generateSingle(params, backend);
      return { content: [{ type: 'text' as const, text: result }] };
    } catch (e) {
      if (e instanceof ConnectionError) {
        return {
          isError: true,
          content: [{
            type: 'text' as const,
            text: `ERROR: ${String(e)}\nServer at ${CONFIG.serverUrl} is not reachable.`,
          }],
        };
      }
      if (e instanceof TimeoutError) {
        return {
          isError: true,
          content: [{
            type: 'text' as const,
            text:
              `ERROR: ${String(e)}\n` +
              `Generation timed out for image_type=${params.image_type}. ` +
              'Try ICON or THUMBNAIL (fastest models).',
          }],
        };
      }
      if (e instanceof GenerationError) {
        const errStr = String(e).toLowerCase();
        const hint =
          errStr.includes('out of memory') || errStr.includes('oom')
            ? ' GPU out of memory — try a smaller type or reduce width/height.'
            : '';
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `ERROR: ${String(e)}${hint}` }],
        };
      }
      return {
        isError: true,
        content: [{ type: 'text' as const, text: `ERROR: ${String(e)}` }],
      };
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Tool: batch_generate
// ─────────────────────────────────────────────────────────────────────────────

server.registerTool(
  'batch_generate',
  {
    description: [
      'Generate multiple images sequentially (GPU runs one at a time).',
      '',
      'Args:',
      '  images: Array of objects, each with the same params as generate_image.',
      '          Required keys per entry: image_type, description. output_path is optional (defaults to generated/<slug>.png).',
      '          All other generate_image params are optional.',
      '',
      'Returns a summary report with success/failure status for each image.',
    ].join('\n'),
    inputSchema: {
      images: z.array(
        z.object({
          image_type: z.string(),
          description: z.string(),
          output_path: z.string().optional(),
          style: z.string().optional(),
          mood: z.string().optional(),
          color_palette: z.string().optional(),
          composition: z.string().optional(),
          lighting: z.string().optional(),
          negative_prompt: z.string().optional(),
          model: z.string().optional(),
          quality: z.string().optional(),
          width: z.number().int().positive().optional(),
          height: z.number().int().positive().optional(),
          seed: z.number().int().nonnegative().optional(),
        }),
      ).describe('List of image generation requests'),
    },
  },
  async ({ images }) => {
    if (images.length === 0) {
      return { isError: true, content: [{ type: 'text' as const, text: 'No images provided.' }] };
    }

    const MAX_BATCH = 50;
    if (images.length > MAX_BATCH) {
      return {
        isError: true,
        content: [{
          type: 'text' as const,
          text: `Batch too large: ${images.length} images. Maximum is ${MAX_BATCH} per batch.`,
        }],
      };
    }

    const results: string[] = [];
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < images.length; i++) {
      const entry = images[i];
      const prefix = `[${i + 1}/${images.length}]`;

      if (!entry.image_type || !entry.description) {
        results.push(
          `${prefix} SKIP: missing required field ` +
          `(image_type=${JSON.stringify(entry.image_type)})`,
        );
        failed++;
        continue;
      }

      try {
        const result = await generateSingle(entry, backend);
        results.push(`${prefix} OK: ${result}`);
        succeeded++;
      } catch (e) {
        results.push(`${prefix} FAIL (${entry.image_type}): ${String(e)}`);
        failed++;
      }
    }

    const summary = `\n=== Batch complete: ${succeeded} OK, ${failed} failed ===\n`;
    return { content: [{ type: 'text' as const, text: results.join('\n') + summary }] };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Tool: list_capabilities
// ─────────────────────────────────────────────────────────────────────────────

const COLOR_PALETTES = ['warm', 'cool', 'monochrome', 'pastel', 'vibrant', 'earth_tones', 'neon', 'dark'];

server.registerTool(
  'list_capabilities',
  {
    description: 'List all available image types, styles, moods, compositions, lighting, palettes, and models.',
    inputSchema: {},
  },
  async () => {
    const typesInfo = Object.entries(IMAGE_TYPE_DEFAULTS).map(([name, cfg]) => {
      const modelId = CONFIG.imageTypes[name]?.model ?? 'unknown';
      return `  ${name}: ${cfg.width}x${cfg.height}, default model=${modelId}, ` +
        `style=${cfg.defaultStyle}, mood=${cfg.defaultMood}`;
    });

    const styleValues = Object.values(Style) as string[];
    const moodValues = Object.values(Mood) as string[];
    const compositionValues = Object.values(Composition) as string[];
    const lightingValues = Object.values(Lighting) as string[];

    const modelsInfo = Object.values(CONFIG.models).map(m =>
      `  ${m.id} -> ${m.filename} (${m.displayName}${m.tier ? ', tier=' + m.tier : ''})`,
    );

    // Derive quality tiers from models
    const allModels = Object.values(CONFIG.models);
    const fastModel = allModels.find(m => m.tier === 'fast');
    const standardModel = allModels.find(m => m.tier === 'standard');
    const highModel = allModels.find(m => m.tier === 'high');
    const qualityInfo = (fastModel || standardModel || highModel)
      ? [
          `  fast     -> ${fastModel?.id ?? '(none)'}`,
          `  standard -> ${standardModel?.id ?? '(none)'}`,
          `  high     -> ${highModel?.id ?? '(none)'}`,
        ]
      : ['  (no models with tier assignments)'];

    const text = [
      `=== Backend: ${CONFIG.backend} ===`,
      `Server: ${CONFIG.serverUrl}`,
      '',
      '=== Image Types ===',
      ...typesInfo,
      '',
      '=== Styles ===',
      '  ' + styleValues.join(', '),
      '',
      '=== Moods ===',
      '  ' + moodValues.join(', '),
      '',
      '=== Compositions ===',
      '  ' + compositionValues.join(', '),
      '',
      '=== Lighting ===',
      '  ' + lightingValues.join(', '),
      '',
      '=== Color Palettes ===',
      '  ' + COLOR_PALETTES.join(', '),
      '',
      '=== Models ===',
      ...modelsInfo,
      '',
      '=== Quality Tiers ===',
      ...qualityInfo,
    ].join('\n');

    return { content: [{ type: 'text' as const, text }] };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Tool: check_server
// ─────────────────────────────────────────────────────────────────────────────

server.registerTool(
  'check_server',
  {
    description: 'Check if the image generation server is reachable. Returns the server status and detected backend.',
    inputSchema: {},
  },
  async () => {
    const healthy = await backend.checkHealth(CONFIG.serverUrl);

    const text = healthy
      ? `Image generation server at ${CONFIG.serverUrl} is ONLINE and ready.\n` +
        `Backend: ${CONFIG.backend}`
      : `Image generation server at ${CONFIG.serverUrl} is OFFLINE. ` +
        'Check that the server is running and accessible on the network.';
    return { content: [{ type: 'text' as const, text }] };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
