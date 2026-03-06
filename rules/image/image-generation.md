# Image Generation

## Mandatory Workflow

ALWAYS use `/claude-imagine:image-generate` skill, NEVER call `generate_image` directly.
The skill engineers a 150-250 word prompt before generating — the only exception is inside the skill itself.

NEVER use placeholder services (picsum, placehold.it, via.placeholder, lorempixel) or empty `src=""`.

## Inline Generation (Default Behavior)

Generate images **as you code**, not in advance. When you encounter a spot that needs an image:

1. Use the current coding context (surrounding HTML, component purpose, page theme, brand, colors)
2. Craft a description tailored to that specific spot
3. Call `/claude-imagine:image-generate` with that context-aware description
4. Continue coding with the generated image path

This produces better results than upfront planning because you have full context about what the image needs to convey in its exact location.

## Auto-Activate

No user prompt needed. Invoke `/claude-imagine:image-generate` automatically when you encounter:
- HTML `<img>` tags needing real images
- Landing pages, hero sections, banners
- Blog posts or articles needing illustrations
- E-commerce product images or thumbnails
- Any project where visuals improve quality

## Image Type Selection

| Tier | Types | Use For |
|------|-------|---------|
| Fast | ICON, THUMBNAIL, BACKGROUND, TEXTURE | UI elements, cards, backgrounds |
| Medium | AVATAR, CONTENT, BANNER, PRODUCT | People, articles, products |
| High | LOGO, HERO, FEATURED | Brand assets, hero sections |

## Workflow

1. **While coding** — encounter image need → `/claude-imagine:image-generate` with full context
2. **Bulk generation** — `batch_generate(images=[...])` when multiple images are needed simultaneously
3. **Explicit planning** — `/claude-imagine:image-suggest` only when user explicitly requests an image plan

## Pre-Generation Checklist

- [ ] Using `/claude-imagine:image-generate` skill (not direct `generate_image`)
- [ ] Image type matches content purpose
- [ ] Output path specified and valid
- [ ] No placeholder URLs in codebase

## Reference

See skill: `claude-imagine:image-generate` for prompt engineering and generation workflow.
See skill: `claude-imagine:image-suggest` for project-wide image planning (user-invoked only).
