# 🚀 Getting Started

## 📋 Requirements

| Requirement | Details |
|-------------|---------|
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | Installed and working |
| [Node.js](https://nodejs.org/) | v20 or later |
| [ComfyUI](https://github.com/comfyanonymous/ComfyUI) | Running with GPU access |

You need at least one checkpoint or diffusion model installed. Claude-Imagine auto-discovers whatever models your server has and adapts to them.

Any NVIDIA card with **8GB+ VRAM** works for most models. Larger models (e.g. Flux) benefit from **24GB+**.

> **Tested with** (but not limited to):
>
> | Model | File | Quality | VRAM |
> |-------|------|---------|------|
> | SDXL Lightning | `sdxl_lightning_4step.safetensors` | Good | 8GB+ |
> | Flux Schnell | `flux1-schnell.safetensors` | Better | 24GB+ |
> | Flux Dev | `flux1-dev.safetensors` | Best | 24GB+ |
>
> Use any models you like — these are just examples we've tested with. Generation speed depends on your GPU, model, and resolution.
>
> **Important:** Checkpoint models (e.g. SDXL) bundle their own CLIP and VAE — no extra files needed. However, UNET/diffusion models (e.g. Flux) require separate CLIP and VAE files. During interactive setup, you will be prompted to select the correct files for each non-checkpoint model. **You must know which CLIP and VAE files your specific model requires before running the installer.** See [CLIP & VAE for Flux Models](#clip--vae-for-flux-models) below.

---

## 📦 Install

### Option 1: npx (recommended)

```bash
npx claude-imagine@latest
```

The interactive installer walks you through scope selection, server detection, and model discovery.

> **Tip — local scope:** When you choose **Local** during setup, `npx` automatically uses your current working directory as the target project — no path entry needed. This is the main reason `npx` is the preferred install method for per-project installs.

### Option 2: From source (contributors)

```bash
git clone https://github.com/prenats/claude-imagine.git
cd claude-imagine
npm install
npm run build
./install.sh
```

> **Local scope note:** If you run `./install.sh` from inside the cloned repo and choose **Local** scope, the installer detects this and warns you. You will be prompted to enter the path to the project you want to install into. Press Enter to accept the suggested default (`pwd`), or type an absolute path (e.g. `~/projects/my-app`). The directory is created automatically if it does not exist.

---

## 📂 What the Installer Does

| Component | Installed To | Purpose |
|-----------|-------------|---------|
| 🎨 image-generate skill | `~/.claude/skills/claude-imagine/image-generate/SKILL.md` | Prompt engineering + image generation workflow |
| 💡 image-suggest skill | `~/.claude/skills/claude-imagine/image-suggest/SKILL.md` | Project image planning + batch generation |
| ⌨️ image-generate command | `~/.claude/commands/claude-imagine/image-generate.md` | `/claude-imagine:image-generate` slash command |
| ⌨️ image-suggest command | `~/.claude/commands/claude-imagine/image-suggest.md` | `/claude-imagine:image-suggest` slash command |
| 📏 image-generation rule | `~/.claude/rules/image/image-generation.md` | Enforces prompt engineering, bans placeholders |
| ⚙️ Config file | `~/.config/claude-imagine/config.json` | Server URL, discovered models, type assignments |
| 🔌 MCP registration | Automatic | Registers via `claude mcp add` |

The scope (global `~/.claude/` or local `.claude/`) is chosen during setup.

---

## ✅ Verify Installation

```bash
npx claude-imagine check
```

Or from source:

```bash
./install.sh --check
```

This confirms:
- ✅ Skills are installed at the expected locations
- ✅ Commands and rules are in place
- ✅ Config file exists and is valid JSON
- ✅ ComfyUI server is reachable

---

## ⚙️ Configuration

All configuration lives in `~/.config/claude-imagine/config.json`, generated during setup. You can edit it manually at any time — changes take effect the next time the MCP server restarts (i.e., next Claude Code session).

<details>
<summary><strong>Full example config</strong></summary>

```json
{
  "backend": "comfyui",
  "server": { "url": "http://localhost:8188" },
  "models": {
    "sdxl_lightning_4step": {
      "filename": "sdxl_lightning_4step.safetensors",
      "displayName": "SDXL Lightning 4step",
      "type": "checkpoint",
      "tier": "fast",
      "params": { "steps": 4, "cfg": 1.0, "sampler": "euler", "scheduler": "sgm_uniform" }
    },
    "flux1_schnell": {
      "filename": "flux1-schnell.safetensors",
      "displayName": "Flux1 Schnell",
      "type": "unet",
      "tier": "high",
      "params": {
        "steps": 4, "cfg": 1.0, "sampler": "euler", "scheduler": "simple",
        "clip_name1": "clip_l.safetensors",
        "clip_name2": "t5xxl_fp16.safetensors",
        "vae_name": "ae.safetensors"
      }
    }
  },
  "imageTypes": {
    "ICON": { "model": "sdxl_lightning_4step", "width": 512, "height": 512 },
    "THUMBNAIL": { "model": "sdxl_lightning_4step" },
    "AVATAR": { "model": "flux1_schnell" },
    "HERO": { "model": "flux1_schnell", "width": 1344, "height": 768 }
  },
  "output": { "dir": "generated" }
}
```

</details>

### Config Reference

#### `server`

| Field | Type | Description |
|-------|------|-------------|
| `server.url` | string | ComfyUI server address. Set during install. |

Alternative flat key: `"serverUrl": "http://..."` is also accepted.

```json
"server": { "url": "http://192.168.1.100:8188" }
```

#### `backend`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `backend` | string | `"comfyui"` | Backend engine name. Currently only `comfyui` is supported. |

#### `models`

Each key is a model ID (used in `--model` and `imageTypes` references). The installer auto-discovers models, but you can add, remove, or edit entries manually.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `filename` | string | yes | Exact filename on the ComfyUI server (e.g. `flux1-schnell.safetensors`) |
| `displayName` | string | no | Human-readable name shown in logs and `list_capabilities` |
| `type` | `"checkpoint"` or `"unet"` | yes | Model architecture. Determines which ComfyUI workflow is used. |
| `tier` | `"fast"`, `"standard"`, or `"high"` | no | Quality tier — controls which image types use this model and how `--quality` resolves. Assigned during interactive setup. |
| `params.steps` | number | no | Number of sampling steps. Lower = faster, higher = more detail. |
| `params.cfg` | number | no | Classifier-free guidance scale. Higher = stricter prompt adherence. Most Flux models use `1.0`. |
| `params.sampler` | string | no | Sampling algorithm (e.g. `"euler"`, `"dpmpp_2m"`, `"uni_pc"`). |
| `params.scheduler` | string | no | Noise schedule (e.g. `"sgm_uniform"`, `"simple"`, `"normal"`, `"karras"`). |
| `params.clip_name1` | string | no | CLIP model filename (UNET models only). |
| `params.clip_name2` | string | no | Second CLIP/T5 model filename (UNET models only). |
| `params.vae_name` | string | no | VAE model filename (UNET models only). |

**Adding a model manually:**

```json
"my_custom_model": {
  "filename": "dreamshaperXL_v21.safetensors",
  "displayName": "DreamShaper XL v2.1",
  "type": "checkpoint",
  "tier": "standard",
  "params": { "steps": 25, "cfg": 7.0, "sampler": "dpmpp_2m", "scheduler": "karras" }
}
```

Then reference it in `imageTypes` or use `--model my_custom_model` per-request.

**Tuning generation parameters:**

Adjusting `steps`, `cfg`, `sampler`, and `scheduler` directly affects image quality and speed. For example, to make a model faster at the cost of quality:

```json
"params": { "steps": 8, "cfg": 1.0, "sampler": "euler", "scheduler": "sgm_uniform" }
```

Or for higher quality with longer generation time:

```json
"params": { "steps": 30, "cfg": 7.5, "sampler": "dpmpp_2m", "scheduler": "karras" }
```

#### `imageTypes`

Maps each image type to a model and optionally overrides default dimensions. The installer generates this automatically from your tier selections.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | yes | Model ID (must match a key in `models`) |
| `width` | number | no | Override default width for this type |
| `height` | number | no | Override default height for this type |

```json
"imageTypes": {
  "ICON": { "model": "sdxl_lightning_4step", "width": 256, "height": 256 },
  "HERO": { "model": "flux1_schnell", "width": 1920, "height": 1080 },
  "CONTENT": { "model": "flux1_dev" }
}
```

You only need to list the types you want to customize. Unlisted types fall back to their tier's default model and hardcoded dimensions (see [image types table](./image-reference.md#️-image-types)).

#### `output`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `output.dir` | string | `"generated"` | Directory where images are saved (relative to the project root). |

Alternative flat key: `"defaultOutputDir": "images"` is also accepted.

### Quality Tiers

Each model has a `tier` that you assign during interactive setup: `fast`, `standard`, or `high`. This controls two things:

1. **Image type → model mapping.** The installer auto-assigns image types to models based on tiers:

   | Tier | Image Types |
   |------|-------------|
   | `fast` | ICON, THUMBNAIL, BACKGROUND, TEXTURE |
   | `standard` | AVATAR, CONTENT, BANNER, PRODUCT |
   | `high` | LOGO, HERO, FEATURED |

2. **`--quality` parameter.** When you pass `--quality fast` on a generation request, it selects the first model with `"tier": "fast"` in your config.

To change a model's tier after setup, edit the `tier` field directly:

```json
"flux1_schnell": {
  "tier": "standard"
}
```

### CLIP & VAE for Flux Models

Checkpoint models (e.g. SDXL) bundle their own CLIP and VAE — no extra files needed.

**UNET models (e.g. Flux) require separate CLIP and VAE files.** The installer discovers them on your server and prompts you to select the right files. You can change them later by editing `params`:

| Field | Common File | Purpose |
|-------|------------|---------|
| `params.clip_name1` | `clip_l.safetensors` | Language model (CLIP-L) |
| `params.clip_name2` | `t5xxl_fp16.safetensors` or `t5xxl_fp8.safetensors` | Text encoder (T5-XXL) |
| `params.vae_name` | `ae.safetensors` | Image decoder |

### Environment Variables

Environment variables override config file values. Useful for CI, Docker, or multi-server setups.

| Variable | Overrides | Example |
|----------|-----------|---------|
| `IMAGINE_SERVER_URL` | `server.url` | `http://192.168.1.100:8188` |
| `IMAGINE_BACKEND` | `backend` | `comfyui` |
| `IMAGINE_OUTPUT_DIR` | `output.dir` | `images/generated` |
| `IMAGINE_CONFIG` | Config file path | `/path/to/config.json` |

> **Priority:** environment variables > config file > hardcoded defaults

---

## 🎨 Your First Image

Once installed, open Claude Code in any project and run:

```
/claude-imagine:image-generate a cozy coffee shop on a rainy evening
```

Claude will:

1. **Infer** the image type (`CONTENT` by default)
2. **Engineer** a 150-250 word prompt covering scene composition, lighting, atmosphere, camera specs, color grading, materials, style markers, and quality anchors
3. **Select** the appropriate model based on the image type's quality tier
4. **Generate** by sending the workflow to ComfyUI
5. **Save** the PNG to `generated/cozy-coffee-shop-rainy-evening.png`

For bulk generation, use the suggest skill to plan images for an entire project:

```
/claude-imagine:image-suggest
```

---

## 🛠️ Generation Options

All options can be passed inline with the description using `--flag value` or `key: value` syntax:

```
/claude-imagine:image-generate a belgian malinois running --model flux1_dev
/claude-imagine:image-generate a minimalist app icon --type ICON --style vector
/claude-imagine:image-generate product photo of leather boots --type PRODUCT --seed 42
/claude-imagine:image-generate hero image for a wellness brand --output images/hero.png
```

### Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `--type` | Image type: ICON, THUMBNAIL, BACKGROUND, TEXTURE, AVATAR, CONTENT, BANNER, PRODUCT, LOGO, HERO, FEATURED | Inferred from description |
| `--model` | Force a specific generation model (e.g. `flux1_dev`, `flux1_schnell`, `sdxl_lightning_4step`) | Auto-selected by image type tier |
| `--style` | Visual style (see [styles](./image-reference.md#️-styles)) | Inferred from type |
| `--mood` | Emotional tone (see [moods](./image-reference.md#-moods)) | Inferred from type |
| `--lighting` | Lighting setup (see [lighting](./image-reference.md#-lighting)) | Inferred from type |
| `--composition` | Camera composition (see [compositions](./image-reference.md#-compositions)) | Inferred from type |
| `--palette` | Color palette (see [palettes](./image-reference.md#-color-palettes)) | Inferred from type |
| `--quality` | Quality tier: `fast`, `standard`, `high` — overrides model selection | Inferred from type |
| `--output` | Output file path | `generated/<slugified-description>.png` |
| `--seed` | Seed for reproducibility | Random |
| `--width` | Override width (max 1536, rounded to multiple of 8) | Type-specific |
| `--height` | Override height (max 1536, rounded to multiple of 8) | Type-specific |
| `--negative_prompt` | Custom negative terms to avoid (SDXL only, comma-separated) | Auto-generated |

### Model Override

By default, the image type determines which model is used based on quality tiers configured during install:

| Tier | Image Types | Default Behavior |
|------|-------------|-----------------|
| Fast | ICON, THUMBNAIL, BACKGROUND, TEXTURE | Uses the fastest model |
| Standard | AVATAR, CONTENT, BANNER, PRODUCT | Uses a mid-speed model |
| High | LOGO, HERO, FEATURED | Uses the highest-quality model |

You can **override the model for any single generation** with `--model`:

```
/claude-imagine:image-generate a sunset landscape --model flux1_dev
```

This uses `flux1_dev` regardless of what the image type would normally select. Available model names match the keys in your `~/.config/claude-imagine/config.json` under `models`.

To **permanently change** which model an image type uses, edit the `imageTypes` section in `config.json`:

```json
"imageTypes": {
  "CONTENT": { "model": "flux1_dev" }
}
```

### Custom Resolutions

Each image type has a default resolution (e.g. ICON = 512x512, HERO = 1344x768). You can override these defaults per image type in `config.json` by adding `width` and/or `height`:

```json
"imageTypes": {
  "ICON": { "model": "sdxl_lightning_4step", "width": 256, "height": 256 },
  "HERO": { "model": "flux1_schnell", "width": 1920, "height": 1080 }
}
```

Resolution priority:
1. **Per-request** `--width` / `--height` params (highest)
2. **Config** `imageTypes` width/height overrides
3. **Hardcoded** type defaults (see [image types table](./image-reference.md#️-image-types))

All values are clamped to 64–1536 and rounded down to the nearest multiple of 8.

### Output

After generation, you'll see a summary table:

```
Image generated: generated/belgian-malinois-running.png

┌────────┬──────────────────────────────────────────────────┐
│ Detail │ Value                                            │
├────────┼──────────────────────────────────────────────────┤
│ Type   │ CONTENT                                          │
│ Model  │ flux1_dev                                        │
│ Size   │ 1024×768                                         │
│ File   │ 891.0 KB                                         │
│ Seed   │ 3132552165                                       │
│ Time   │ 24.1s                                            │
│ Prompt │ "Athletic Belgian Malinois in explosive full..." │
└────────┴──────────────────────────────────────────────────┘
```

The **Seed** value can be reused with `--seed` to reproduce the same image.

> See [image-reference.md](./image-reference.md) for all types, styles, moods, and options.

---

## 🗑️ Uninstall

```bash
npx claude-imagine uninstall
```

Or from source:

```bash
./install.sh --uninstall
```

This removes skills, commands, rules, and MCP registration. The config file at `~/.config/claude-imagine/` is preserved — delete it manually if you want a clean removal.
