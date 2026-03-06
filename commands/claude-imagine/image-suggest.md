# (Claude-Imagine) — Project Image Planning & Visual Asset Strategy

Analyze a project and produce a prioritized, context-aware set of image recommendations. Optionally generate all images in one go.

## When to Activate

**User-invoked only** — do NOT auto-trigger during coding flow. Use `/claude-imagine:image-generate` inline instead.

Activate ONLY when the user explicitly:
- Asks "what images do I need?" or wants image recommendations
- Requests a visual asset plan or audit
- Runs `/claude-imagine:image-suggest` directly
- Wants to see all needed images before starting a project

## Usage

```
/claude-imagine:image-suggest
/claude-imagine:image-suggest a SaaS landing page for a project management tool
/claude-imagine:image-suggest a construction equipment reseller website
/claude-imagine:image-suggest --generate
```

## Argument Parsing

Parse `$ARGUMENTS` for:

- **Project description** — free-text description (optional; scans project files if omitted)
- `--generate` — skip confirmation, generate all suggestions immediately
- `--output-dir PATH` — base directory for output files. Default: `generated/`
- `--max NUMBER` — maximum suggestions. Default: 6

## Workflow

```
┌─────────────────────────────────────────────────┐
│  1. UNDERSTAND PROJECT                          │
│     Scan files or use provided description      │
│     Classify into project archetype             │
├─────────────────────────────────────────────────┤
│  2. GENERATE SUGGESTIONS (4-8 images)           │
│     Project-specific descriptions, not generic   │
│     Priority: must-have → important → nice       │
├─────────────────────────────────────────────────┤
│  3. DISPLAY RECOMMENDATIONS                     │
│     Formatted list with rationale per image     │
│     Ask: "Generate all? (yes / select / no)"    │
├─────────────────────────────────────────────────┤
│  4. GENERATE SELECTED IMAGES                    │
│     Full /claude-imagine:image-generate workflow │
│     per image (150-250 word prompts)            │
├─────────────────────────────────────────────────┤
│  5. SUMMARY REPORT                              │
│     Paths, dimensions, seeds for reproducibility │
└─────────────────────────────────────────────────┘
```

## Step 1: Understand the Project

If a description was provided, use it. Otherwise, scan the project:

- `README.md` or `CLAUDE.md` for project purpose
- `package.json` or config files for name/description
- HTML files for existing structure
- Existing images to avoid duplicates

Classify into an archetype:

| Archetype | Signals |
|-----------|---------|
| landing_page | Marketing, SaaS, product page |
| blog | Content, articles, news |
| ecommerce | Products, shop, marketplace |
| portfolio | Personal, agency, showcase |
| dashboard | Admin panel, analytics, SaaS app |
| restaurant | Food, hospitality, menu |
| construction | Heavy industry, equipment, real estate |
| wellness | Health, fitness, beauty, medical |
| tech | Software, startup, developer tool |
| education | Courses, tutorials, learning platform |

## Step 2: Generate Suggestions

Produce **4-8 image recommendations** tailored to this project. For each, consider:

1. What images does this project type actually need?
2. What makes this project unique? Use project-specific details, not generic descriptions.
3. What visual style fits the brand and industry?

Each suggestion:
```json
{
  "priority": 1,
  "image_type": "HERO",
  "description": "<specific, detailed description for THIS project>",
  "style": "cinematic",
  "mood": "professional",
  "lighting": "golden_hour",
  "composition": "wide_angle",
  "color_palette": "warm",
  "quality": "high",
  "output_path": "images/hero.png",
  "rationale": "<one sentence: why this image is needed>"
}
```

### Industry Defaults

| Project Type | Key Images | Style Direction |
|---|---|---|
| E-commerce | Product shots, hero, category thumbnails | Photorealistic, studio lighting |
| SaaS | Hero, feature illustrations, UI backgrounds | Digital art or minimalist, professional |
| Construction | Machinery shots, aerial/drone hero, texture | Photorealistic, dramatic, cinematic |
| Wellness | Nature, lifestyle, warm portraits | Soft lighting, warm palette, calm |
| Restaurant | Food close-ups, interior ambiance, hero | Cinematic, warm, golden hour |
| Portfolio | Showcase images, avatar, background | Matches artist's medium |

## Step 3: Display Recommendations

```
Detected project: [archetype] — [brief description]

Recommended images (N):

1. [MUST-HAVE] HERO — images/hero.png
   "description excerpt..."
   Style: cinematic | Mood: dramatic | Tier: High
   Why: First impression for homepage

2. [IMPORTANT] PRODUCT — images/product-main.png
   "description excerpt..."
   Style: photorealistic | Mood: professional | Tier: Standard
   Why: Primary product showcase

...

Generate all N images? (yes / select numbers e.g. 1,2,3 / no)
```

## Step 4: Generate Selected Images

For each selected image, apply the full `/claude-imagine:image-generate` prompt engineering workflow:

1. Take suggestion description as starting point
2. Expand to 150-250 word ultra-detailed prompt (all 8 dimensions from /claude-imagine:image-generate Step 2)
3. Call `generate_image` with all suggested parameters
4. Report result

If `--generate` flag was passed, skip confirmation and generate all automatically.

## Step 5: Summary Report

```
=== Image generation complete ===
- images/hero.png (1344x768, seed: 1234)
- images/logo.png (1024x1024, seed: 5678)
- images/banner.png (1344x384, seed: 9012)

All images saved to [output-dir]/
Use seeds above to regenerate any image with the same result.
```

## Example

**Input:** `/claude-imagine:image-suggest a construction equipment reseller — trucks, excavators, Caterpillar, Kubota`

```
Detected project: construction — heavy equipment sales and reseller

Recommended images (6):

1. [MUST-HAVE] LOGO — images/logo.png
   "Bold CVD lettermark in heavy industrial sans-serif, brushed steel finish..."
   Style: vector | Mood: professional | Tier: High
   Why: Brand identity anchor for all marketing materials

2. [MUST-HAVE] HERO — images/hero.png
   "Aerial drone shot over construction equipment staging yard at golden hour..."
   Style: photorealistic | Mood: dramatic | Tier: High
   Why: First impression hero for homepage

3. [MUST-HAVE] FEATURED — images/excavator.png
   "Professional product shot of Caterpillar 390 hydraulic excavator on neutral gray..."
   Style: photorealistic | Mood: professional | Tier: High
   Why: Primary product category showcase

4. [IMPORTANT] BANNER — images/banner-fleet.png
   "Panoramic silhouette of construction machinery against fiery sunset..."
   Style: cinematic | Mood: dramatic | Tier: Standard
   Why: Section divider and promotional banner

5. [IMPORTANT] THUMBNAIL — images/thumb-trucks.png
   "Fleet of heavy-duty dump trucks with oversized tires, dusty construction site..."
   Style: photorealistic | Mood: energetic | Tier: Fast
   Why: Product category card for trucks

6. [NICE-TO-HAVE] BACKGROUND — images/bg-texture.png
   "Industrial steel plate texture with subtle grid pattern, dark gunmetal surface..."
   Style: photorealistic | Mood: professional | Tier: Fast
   Why: Section background texture for dark-themed pages

Generate all 6 images? (yes / select numbers e.g. 1,2,3 / no)
```

## Quality Gate

Before delivering suggestions:
- Every description is specific to the project, not generic
- Priority order makes sense (hero/logo first, decorative last)
- No duplicate image types unless justified
- Style/mood/lighting choices match the industry
- Output paths are unique and descriptive

Before generating:
- Each prompt goes through full /claude-imagine:image-generate 150-250 word engineering
- No short descriptions passed directly to generate_image

## Anti-Patterns

- **Generic suggestions**: "a hero image" instead of project-specific "aerial drone shot over construction staging yard"
- **Skipping prompt engineering**: Passing suggestion descriptions directly to generate_image without expanding to 150-250 words
- **Wrong priorities**: Putting decorative textures ahead of hero and logo
- **Ignoring existing images**: Suggesting duplicates of images already in the project
- **One-size-fits-all**: Using the same suggestions for every project type
