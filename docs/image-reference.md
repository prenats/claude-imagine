# 🎨 Image Reference

Complete reference for all image types, styles, moods, compositions, lighting options, and color palettes.

---

## 🖼️ Image Types

| Type | Resolution | Default Style | Default Mood | Tier | Use For |
|------|-----------|--------------|-------------|------|---------|
| `ICON` | 512x512 | vector | professional | ⚡ Fast | App icons, UI elements, favicons |
| `THUMBNAIL` | 768x432 | digital_art | energetic | ⚡ Fast | Blog cards, video thumbnails |
| `BACKGROUND` | 1344x768 | digital_art | calm | ⚡ Fast | Page/section backgrounds |
| `TEXTURE` | 1024x1024 | photorealistic | professional | ⚡ Fast | Tileable patterns, surfaces |
| `AVATAR` | 768x768 | photorealistic | professional | ⏱️ Standard | Profile photos, team portraits |
| `CONTENT` | 1024x768 | illustration | professional | ⏱️ Standard | Article illustrations |
| `BANNER` | 1344x384 | cinematic | dramatic | ⏱️ Standard | Horizontal promo strips |
| `PRODUCT` | 896x1152 | photorealistic | professional | ⏱️ Standard | E-commerce product photos |
| `LOGO` | 1024x1024 | vector | professional | 🎯 High | Brand logo marks |
| `HERO` | 1344x768 | cinematic | dramatic | 🎯 High | Full-width hero sections |
| `FEATURED` | 1024x1024 | photorealistic | elegant | 🎯 High | Featured post/card images |

> Generation speed depends on your GPU, model, and resolution. Tiers indicate relative quality, not fixed timing.

> During setup, you assign each model a quality tier (`fast`, `standard`, or `high`). Image types are then mapped to models based on their tier. You can change these assignments at any time in `config.json` — see [Configuration](./getting-started.md#️-configuration).

---

## ⚡ Quality Tiers

During interactive setup, you assign each model a tier. This determines which image types use that model by default.

| Tier | Image Types | Typical Use |
|------|-------------|-------------|
| `fast` | ICON, THUMBNAIL, BACKGROUND, TEXTURE | UI elements, quick iterations, decorative assets |
| `standard` | AVATAR, CONTENT, BANNER, PRODUCT | Content images, profiles, e-commerce |
| `high` | LOGO, HERO, FEATURED | Brand assets, hero sections, showcase images |

### How tiers work

- Each model has a `tier` field in `config.json` (`"fast"`, `"standard"`, or `"high"`).
- The installer auto-maps image types to models based on their tier (see table above).
- The `--quality` parameter selects a model by tier at generation time: `--quality fast` picks the first model with `"tier": "fast"`.
- If no model matches a tier, the first available model is used as fallback.

### Changing tiers after setup

Edit the `tier` field in `~/.config/claude-imagine/config.json`:

```json
"models": {
  "flux1_schnell": {
    "tier": "standard"
  }
}
```

Or override which model an image type uses directly:

```json
"imageTypes": {
  "HERO": { "model": "flux1_dev" }
}
```

> If you only have one model, all tiers and image types use that model automatically.

---

## 🖌️ Styles

| Value | Description |
|-------|-------------|
| `photorealistic` | Realistic photography look |
| `illustration` | Digital illustration style |
| `watercolor` | Watercolor painting effect |
| `oil_painting` | Traditional oil painting |
| `digital_art` | Modern digital artwork |
| `vector` | Clean vector graphics look |
| `pixel_art` | Retro pixel art style |
| `sketch` | Hand-drawn sketch |
| `3d_render` | 3D rendered scene |
| `anime` | Japanese anime style |
| `cinematic` | Film/movie aesthetic |
| `minimalist` | Clean, minimal design |
| `comic` | Comic book style |
| `vintage` | Retro/aged look |
| `abstract` | Non-representational art |

---

## 🎭 Moods

| Value | Description |
|-------|-------------|
| `energetic` | High energy, dynamic |
| `calm` | Peaceful, serene |
| `dramatic` | High contrast, intense |
| `playful` | Fun, lighthearted |
| `mysterious` | Enigmatic, moody |
| `elegant` | Refined, sophisticated |
| `warm` | Inviting, cozy |
| `cool` | Crisp, modern |
| `professional` | Corporate, polished |
| `whimsical` | Fantastical, dreamy |
| `dark` | Shadow-heavy, noir |
| `bright` | Light, airy |

---

## 📐 Compositions

| Value | Description |
|-------|-------------|
| `centered` | Subject in center |
| `rule_of_thirds` | Classic photography rule |
| `symmetrical` | Mirror balance |
| `diagonal` | Dynamic diagonal lines |
| `framing` | Natural frame around subject |
| `leading_lines` | Lines draw eye to subject |
| `close_up` | Tight crop on subject |
| `wide_angle` | Expansive field of view |
| `birds_eye` | Top-down perspective |
| `low_angle` | Looking up at subject |
| `panoramic` | Ultra-wide horizontal |
| `negative_space` | Minimal subject, lots of space |

---

## 💡 Lighting

| Value | Description |
|-------|-------------|
| `natural` | Outdoor daylight |
| `studio` | Controlled studio setup |
| `dramatic` | Strong directional light |
| `soft` | Diffused, even lighting |
| `golden_hour` | Warm sunset/sunrise light |
| `neon` | Colorful artificial glow |
| `backlit` | Light behind subject |
| `rimlight` | Edge-highlighting light |
| `ambient` | Soft environmental light |
| `high_key` | Bright, low contrast |
| `low_key` | Dark, high contrast |
| `volumetric` | Visible light rays/beams |

---

## 🎨 Color Palettes

| Value | Description |
|-------|-------------|
| `warm` | Reds, oranges, yellows |
| `cool` | Blues, greens, purples |
| `monochrome` | Single color family |
| `pastel` | Soft, muted tones |
| `vibrant` | Saturated, bold colors |
| `earth_tones` | Browns, greens, tans |
| `neon` | Electric, glowing colors |
| `dark` | Deep, shadowy palette |

---

## 🚫 Negative Prompts

Negative prompts are **automatically generated** for SDXL models (Flux models ignore them). They combine three sources:

| Source | Description | Example |
|--------|-------------|---------|
| **Universal** | Applied to all generations | ugly, blurry, low quality, deformed, watermark |
| **Type-specific** | Per image type | ICON: "complex background, text, busy design" |
| **Style-specific** | Per style choice | photorealistic: "cartoon, anime, illustration" |

Custom negative terms can be passed via the `negative_prompt` parameter on `generate_image`.

---

## 📏 Dimension Overrides

Custom `width` and `height` can be specified per-request or as persistent defaults per image type.

### Per-request override

Pass `--width` and/or `--height` on any generation:

```
/claude-imagine:image-generate a landscape --width 1920 --height 1080
```

### Per-type config override

Set default resolutions per image type in `~/.config/claude-imagine/config.json`:

```json
"imageTypes": {
  "ICON": { "model": "sdxl_lightning_4step", "width": 256, "height": 256 },
  "HERO": { "model": "flux1_schnell", "width": 1920, "height": 1080 }
}
```

Only `width` and `height` are optional — `model` is always required. Omitted dimensions fall back to the hardcoded type defaults shown in the [image types table](#️-image-types) above.

### Resolution priority

1. Per-request `width`/`height` params (highest)
2. Config `imageTypes` overrides
3. Hardcoded type defaults

| Constraint | Value |
|-----------|-------|
| Minimum | 64 pixels per side |
| Maximum | 1536 pixels per side |
| Rounding | Down to nearest multiple of 8 |
