# (Claude-Imagine) — AI-Powered Image Generation

Transform short descriptions into ultra-detailed, unique prompts, then generate real images via the image generation server.

## When to Activate

- User asks to generate, create, or make an image
- User needs a hero image, banner, icon, product photo, avatar, logo, or thumbnail
- Working on HTML with `<img>` tags needing real images
- Building landing pages, blogs, e-commerce, portfolios, or dashboards
- Any project where visuals would improve quality
- User says "generate an image of..." or similar

## Usage

```
/claude-imagine:image-generate a cyberpunk cityscape at night
/claude-imagine:image-generate a minimalist app icon --type ICON --style vector
/claude-imagine:image-generate product photo of leather boots --type PRODUCT --model opus --seed 42
/claude-imagine:image-generate hero image for a wellness brand --output images/hero.png
```

## Argument Parsing

Parse `$ARGUMENTS` for:

- **Description** — everything that is not a flag (required)
- `--type TYPE` — ICON, THUMBNAIL, BACKGROUND, TEXTURE, AVATAR, CONTENT, BANNER, PRODUCT, LOGO, HERO, FEATURED. Default: infer.
- `--style STYLE` — photorealistic, illustration, watercolor, oil_painting, digital_art, vector, pixel_art, sketch, 3d_render, anime, cinematic, minimalist, comic, vintage, abstract. Default: infer.
- `--mood MOOD` — energetic, calm, dramatic, playful, mysterious, elegant, warm, cool, professional, whimsical, dark, bright. Default: infer.
- `--lighting LIGHTING` — natural, studio, dramatic, soft, golden_hour, neon, backlit, rimlight, ambient, high_key, low_key, volumetric. Default: infer.
- `--composition COMP` — centered, rule_of_thirds, symmetrical, diagonal, framing, leading_lines, close_up, wide_angle, birds_eye, low_angle, panoramic, negative_space. Default: infer.
- `--palette PALETTE` — warm, cool, monochrome, pastel, vibrant, earth_tones, neon, dark. Default: infer.
- `--quality QUALITY` — fast, standard, high. Default: infer from type.
- `--output PATH` — output file path. Default: `generated/<slugified-description>.png`
- `--seed NUMBER` — for reproducibility. Default: random.
- `--model MODEL` — Claude model for prompt engineering: haiku, sonnet, opus. Default: current session.

## Workflow

```
┌─────────────────────────────────────────────────┐
│  1. INFER PARAMETERS                            │
│     Map description keywords → image type       │
│     Fill missing style/mood/lighting defaults    │
├─────────────────────────────────────────────────┤
│  2. ENGINEER PROMPT (150-250 words)             │
│     Scene, lighting, atmosphere, camera/lens,   │
│     color grading, materials, style, quality     │
├─────────────────────────────────────────────────┤
│  3. OPTIONAL: DELEGATE TO SUB-AGENT             │
│     If --model flag → spawn Agent with model    │
├─────────────────────────────────────────────────┤
│  4. GENERATE IMAGE                              │
│     Call generate_image with crafted prompt      │
├─────────────────────────────────────────────────┤
│  5. REPORT RESULT                               │
│     Path, type, model, dimensions, seed, time   │
└─────────────────────────────────────────────────┘
```

## Step 1: Infer Parameters

From the description, infer any parameters not explicitly provided:

| Keywords in description | Default type |
|---|---|
| icon, app icon, favicon, badge | ICON |
| hero, landing page, full-width, above the fold | HERO |
| product, e-commerce, for sale, shop | PRODUCT |
| banner, header, promo strip | BANNER |
| avatar, portrait, headshot, profile, team | AVATAR |
| logo, brand, mark, wordmark | LOGO |
| thumbnail, card, preview, blog | THUMBNAIL |
| background, backdrop, wallpaper | BACKGROUND |
| texture, pattern, surface, material, tileable | TEXTURE |
| (nothing matches) | CONTENT |

## Step 2: Engineer the Prompt

Use your own language capabilities to generate a rich, unique prompt between **150 and 250 words**. Cover ALL eight dimensions:

### 1. Scene Composition
Specific subjects, spatial relationships, foreground/midground/background layers, scale. Place elements precisely — not "mountains" but "jagged snow-capped peaks in the far background, conifer forest in middle distance, frost-covered granite boulders in immediate foreground".

### 2. Lighting
Specific light sources, direction (e.g., "key light from upper left at 45deg"), quality (hard/soft/diffused), color temperature (e.g., "warm 3200K tungsten fill"), shadow characteristics, specular highlights.

### 3. Atmosphere
Time of day, weather, environmental mood. Atmospheric particles if relevant: dust motes, fog, rain, snow, bokeh circles, volumetric god rays, heat haze. Depth haze and aerial perspective.

### 4. Technical Photography / Rendering
Camera gear (e.g., "shot on Sony A7R V"), lens specs (e.g., "85mm f/1.4"), aperture-driven depth of field, ISO/grain. For illustration/3D: path tracing, subsurface scattering, global illumination, octane render.

### 5. Color Grading
Palette description (e.g., "split-toned with teal shadows and amber highlights"), contrast, saturation, color temperature shifts between shadows and highlights.

### 6. Material & Texture
Surface qualities: matte, glossy, rough, smooth, wet, frosted, metallic, translucent, organic. How light interacts with surfaces.

### 7. Style Markers
Specific artistic techniques, art movements, or rendering approaches. Not "oil painting" but "impasto oil technique, visible palette knife strokes, Rembrandt chiaroscuro".

### 8. Quality Anchors
End with: `masterpiece, award-winning photography, ultra-detailed, 8k resolution` (photorealistic) or `masterpiece, highly detailed, trending on ArtStation, 4k` (illustration).

### Prompt Rules
- Comma-separated descriptive phrases, NOT full sentences
- NO negative terms — those go in negative_prompt
- Weave original description naturally into the prompt
- 150-250 words total
- Specific and concrete ("amber Edison bulb" not "warm light")
- Every prompt must be unique

## Step 3: Optional Sub-Agent Delegation

If `--model` flag provided, spawn an Agent with that model for Step 2:

| Flag | Model ID |
|------|----------|
| `--model haiku` | `claude-haiku-4-5` |
| `--model sonnet` | `claude-sonnet-4-6` |
| `--model opus` | `claude-opus-4-6` |

Sub-agent prompt:
```
You are an expert Stable Diffusion / Flux image prompt engineer.
Generate an ultra-detailed image generation prompt for: [description]
Image type: [type], Style: [style], Mood: [mood], Lighting: [lighting]

Rules: 150-250 words, comma-separated phrases, no negative terms,
cover scene composition, lighting, atmosphere, camera/lens, color grading,
materials/textures, style markers, quality anchors.
Return ONLY the prompt text, nothing else.
```

## Step 4: Call generate_image

```
generate_image(
    image_type=<type>,
    description=<crafted 150-250 word prompt>,
    output_path=<output path>,
    style=<style>,
    mood=<mood>,
    lighting=<lighting>,
    composition=<composition>,
    color_palette=<palette>,
    quality=<quality>,
    seed=<seed or omit>,
)
```

The description is always used verbatim as the positive prompt.

## Step 5: Report Result

```
Image generated: <output_path>
Type: <type> | Model: <generation model> | Size: <WxH> | Seed: <seed>
Time: <duration>
Prompt: "<first 120 chars>..."
```

## Example

**Input:** `/claude-imagine:image-generate a cozy coffee shop on a rainy evening`

**Crafted prompt:**
```
Intimate interior of an artisan coffee shop, warm amber Edison bulb lighting casting
soft golden pools across reclaimed wood countertops, rain-streaked floor-to-ceiling
windows reflecting wet cobblestone street and blurred neon city signs outside,
steam rising from ceramic pour-over vessels on the bar, exposed brick walls with
vintage botanical prints, worn leather armchair in foreground with chunky wool throw,
barista silhouette behind brass espresso machine with warm rimlight halo, shot on
Sony A7R V with 35mm f/1.4 Sigma Art lens, razor-thin depth of field with creamy
bokeh background, split-toned teal shadows and amber highlights, 3200K tungsten fill
balancing 5600K daylight through rain-beaded glass, volumetric light rays cutting
through steam and mist, wet mahogany surfaces with warm specular reflections,
copper fixtures with brushed metallic sheen, cozy hygge atmosphere, masterpiece,
award-winning interior photography, ultra-detailed, 8k resolution
```

## Image Type Reference

| Type | Tier | Resolution | Use For |
|------|------|-----------|---------|
| ICON | Fast | 512x512 | App icons, UI icons, favicons |
| THUMBNAIL | Fast | 768x432 | Blog cards, video thumbnails |
| BACKGROUND | Fast | 1344x768 | Page/section backgrounds |
| TEXTURE | Fast | 1024x1024 | Tileable patterns, surfaces |
| AVATAR | Standard | 768x768 | Profile photos, portraits |
| CONTENT | Standard | 1024x768 | Article illustrations |
| BANNER | Standard | 1344x384 | Horizontal promo strips |
| PRODUCT | Standard | 896x1152 | E-commerce product photos |
| LOGO | High | 1024x1024 | Brand logo marks |
| HERO | High | 1344x768 | Full-width hero sections |
| FEATURED | High | 1024x1024 | Featured post/card images |

## Quality Gate

Before delivering:
- Prompt is 150-250 words with all 8 dimensions covered
- No negative terms in the main prompt
- Description is specific to the user's request, not generic
- Output path is valid and doesn't overwrite without intent
- Image type matches the described content

## Anti-Patterns

- **Short prompts**: Passing a 5-word description directly to generate_image — always engineer the full prompt
- **Generic descriptions**: "a hero image" instead of project-specific details
- **Negative terms in prompt**: "no blur, no artifacts" — use negative_prompt field instead
- **Wrong type**: Using ICON for a full-width header image
- **Placeholder services**: Using picsum.photos or placehold.it instead of generating real images
