<div align="center">
  <h1>Claude-Imagine</h1>
  <p><strong>Context-aware image generation for Claude Code, powered by your local GPU</strong></p>

  <p>An MCP server that lets Claude Code generate real images while it works. No external APIs, no stock photos. Just your GPU and whatever diffusion models you have installed.</p>

  <br/>

  <a href="https://www.npmjs.com/package/claude-imagine"><img src="https://img.shields.io/npm/v/claude-imagine?style=for-the-badge" alt="NPM Version"></a>
  <a href="https://github.com/prenats/claude-imagine/blob/main/LICENSE"><img src="https://img.shields.io/github/license/prenats/claude-imagine?style=for-the-badge" alt="License"></a>
  <a href="https://github.com/prenats/claude-imagine/stargazers"><img src="https://img.shields.io/github/stars/prenats/claude-imagine?style=for-the-badge" alt="Stars"></a>
  <br/><a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=for-the-badge&logo=node.js" alt="Node.js"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/typescript-5.x-blue?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://modelcontextprotocol.io/"><img src="https://img.shields.io/badge/protocol-MCP-8A2BE2?style=for-the-badge" alt="MCP"></a>
  <a href=""><img src="https://img.shields.io/badge/Area-Image-blue?style=for-the-badge&logo=image&logoColor=white" alt="Area Image"></a>

  <sub>⚡ Runs on</sub><br/>
  <img src="https://img.shields.io/badge/backend-ComfyUI-8B5CF6?style=for-the-badge" alt="ComfyUI">


  <a href="docs/getting-started.md"><img src="https://img.shields.io/badge/docs-getting%20started-green?style=for-the-badge" alt="Getting Started"></a>
  <a href="docs/architecture.md"><img src="https://img.shields.io/badge/docs-architecture-orange?style=for-the-badge" alt="Architecture"></a>
  <a href="docs/image-reference.md"><img src="https://img.shields.io/badge/docs-image%20reference-red?style=for-the-badge" alt="Image Reference"></a>
</div>

---

## 💡 Why i made this

Every time you build something with Claude Code, you hit the same wall: placeholder images. Grey boxes, lorem picsum links, "TODO: add real image here." The layout is done, the code is clean, but the result looks lifeless.

**Claude-Imagine changes that.** Claude reads the code it's writing — the HTML structure, the component, the page theme, the brand colors — and uses that context to generate an image tailored for that exact spot. A hero section for a wellness brand gets a hero image that matches the palette and mood of the page. A product card for a vintage leather bag gets a photo that fits the store's tone. Images that belong where they are, because they were born from the context they live in.

When you're not coding, there are direct commands too. `/claude-imagine:image-generate` lets you generate any image on demand with full control over style, mood, lighting, and composition. `/claude-imagine:image-suggest` analyzes a project and recommends a visual asset plan. Same prompt engineering pipeline, just a different trigger.

---

## ✨ Key Features

- **Context-Aware Prompts** — Claude reads the surrounding code and crafts image prompts tailored to the exact spot where the image will live
- **11 Image Types** — icons to hero images, each with optimized defaults for dimensions, style, mood, and lighting
- **Full Creative Control** — 15 styles, 12 moods, 12 compositions, 12 lighting options, 8 color palettes
- **3 Quality Tiers** — fast / standard / high, auto-mapped to your fastest and best models
- **Auto-Detection** — discovers your installed models and assigns them to quality tiers
- **Smart Negative Prompts** — auto-generated per type and style (SDXL only)
- **Pluggable Backends** — ComfyUI today, extensible architecture for future backends
- **Flexible Scope** — install globally or per-project

---

## 🚀 Quick Start

### Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed
- [Node.js](https://nodejs.org/) 20+
- [ComfyUI](https://github.com/comfyanonymous/ComfyUI) running with GPU access
- At least one diffusion model installed

> See [Getting Started](docs/getting-started.md) for more detailed instructions, tested models, VRAM requirements, and CLIP/VAE setup for Flux models, etc.

### Option 1: npx (recommended)

```bash
npx claude-imagine@latest
```

The interactive installer will:

1. Ask for install scope (global or per-project)
2. Copy skills, commands, and rules to your Claude Code config
3. Detect your ComfyUI server and discover installed models
4. Generate config and register the MCP server

> **Tip — local scope:** Run `npx claude-imagine@latest` from inside the project you want to install into. `npx` uses your current directory automatically — no path entry needed. This is the main advantage of `npx` over the from-source install for per-project setups.

### Option 2: From source

```bash
git clone https://github.com/prenats/claude-imagine.git
cd claude-imagine
npm install
npm run build
npm test
./install.sh  # install from source
```

> **Local scope note:** Running `./install.sh` from inside the cloned repo and choosing **Local** scope will show a warning and prompt you to enter the target project path. Type an absolute path (e.g. `~/projects/my-app`) or press Enter to use `pwd`. See [Getting Started](docs/getting-started.md#-install) for details.

### Verify

Open Claude Code and run `/mcp` to check that the Claude-Imagine MCP server is installed and connected. You should see it listed with a green status.

You can also verify from the terminal:

```bash
npx claude-imagine check
```

### First image

```
/claude-imagine:image-generate a cozy coffee shop on a rainy evening
```

> See [Getting Started](docs/getting-started.md) for the full setup guide, configuration, and verification.

---

## 🔄 How It Works

### While coding (automatic)

```
You: "Build me a landing page for a sustainable coffee brand"

Claude Code writes the hero section, hits the <img> tag, and:
  1. Reads the surrounding context (earth-tone palette, organic theme, warm copy)
  2. Engineers a 150-250 word prompt tailored to that exact spot
  3. Picks the right model, resolution, and quality tier
  4. Sends the workflow to ComfyUI on your GPU
  5. Drops the generated PNG into your project and keeps coding

Result: The hero image matches the page — not a random stock photo.
```

### On demand (direct commands)

```
You: /claude-imagine:image-generate a cozy coffee shop on a rainy evening

Claude Code:
  1. Engineers a 150-250 word prompt (scene, lighting, atmosphere, camera, color, materials, style, quality)
  2. Selects the right model and resolution for the image type
  3. Sends the workflow to ComfyUI
  4. Saves the generated PNG to your project

Result: generated/cozy-coffee-shop-rainy-evening.png (1344x768)
```

Both modes use the same pipeline. The difference is where the context comes from — the code Claude is writing, or the description you provide. Prompt engineering runs on whichever Claude model powers your session. Image generation runs on your GPU.

---

## 🎨 Image Types

| Type | Resolution | Tier | Use For |
|------|-----------|------|---------|
| `ICON` | 512x512 | Fast | App icons, UI elements, favicons |
| `THUMBNAIL` | 768x432 | Fast | Blog cards, video thumbnails |
| `BACKGROUND` | 1344x768 | Fast | Page/section backgrounds |
| `TEXTURE` | 1024x1024 | Fast | Tileable patterns, surfaces |
| `AVATAR` | 768x768 | Standard | Profile photos, team portraits |
| `CONTENT` | 1024x768 | Standard | Article illustrations |
| `BANNER` | 1344x384 | Standard | Horizontal promo strips |
| `PRODUCT` | 896x1152 | Standard | E-commerce product photos |
| `LOGO` | 1024x1024 | High | Brand logo marks |
| `HERO` | 1344x768 | High | Full-width hero sections |
| `FEATURED` | 1024x1024 | High | Featured post/card images |

> See [Image Reference](docs/image-reference.md) for all styles, moods, compositions, lighting, palettes, and dimension overrides.

---

## 🛠️ Usage

### Skills (user-facing)

These are the slash commands you invoke directly in Claude Code:

| Skill | Description |
|-------|-------------|
| `/claude-imagine:image-generate` | Engineer a detailed prompt and generate an image |
| `/claude-imagine:image-suggest` | Analyze a project and recommend 4-8 images with types, styles, and rationale |

### MCP Tools (what Claude calls under the hood)

Skills call these tools on the MCP server. You don't invoke them directly — Claude does.

| Tool | Description |
|------|-------------|
| `generate_image` | Generate a single image with full control over type, style, mood, lighting, composition, palette, quality, dimensions, seed |
| `batch_generate` | Generate multiple images sequentially (one GPU job at a time) |
| `list_capabilities` | List all available types, styles, moods, compositions, lighting, palettes, and discovered models |
| `check_server` | Check if ComfyUI is reachable and report detected backend |

### CLI

| Command | Description |
|---------|-------------|
| `npx claude-imagine@latest` | Run interactive setup |
| `npx claude-imagine check` | Verify installation (skills, config, server) |
| `npx claude-imagine uninstall` | Remove all installed files and MCP registration |
| `npx claude-imagine --version` | Print version |

---

## ⚙️ Configuration

Config file: `~/.config/claude-imagine/config.json` (auto-generated during setup)

| Setting | What it controls |
|---------|-----------------|
| `server.url` | ComfyUI server address |
| `models` | Discovered models with type, tier, and sampling params |
| `imageTypes` | Which model each image type uses, with optional dimension overrides |
| `output.dir` | Where generated images are saved (default: `generated`) |

### Environment Variable Overrides

| Variable | Description |
|----------|-------------|
| `IMAGINE_SERVER_URL` | Override server URL |
| `IMAGINE_BACKEND` | Override backend (default: `comfyui`) |
| `IMAGINE_OUTPUT_DIR` | Override output directory |
| `IMAGINE_CONFIG` | Override config file path |

> Priority: environment variables > config file > hardcoded defaults

> See [Getting Started](docs/getting-started.md#%EF%B8%8F-configuration) for the full config reference, model tuning, quality tiers, and CLIP/VAE setup.

---

## 🏛️ Architecture Overview

```
Skill (/claude-imagine:image-generate)
  │  Claude engineers a 150-250 word prompt
  │  Infers type, style, mood, lighting from context
  ▼
MCP Tool (generate_image)
  │  Validates params, resolves model and dimensions
  ▼
Backend (ComfyUI)
  │  Builds workflow → queues prompt → polls for result → downloads PNG
  ▼
Output
     Saves image to project, returns report
```

The backend is pluggable — any server that implements the `ImageBackend` interface can be added to Claude-Imagine.

> See [Architecture](docs/architecture.md) for the full module map, generation flow, backend abstraction, and config chain.

---

## 🤝 Contributing

Contributions are welcome — whether it's a bug fix, a new backend, or an improvement to prompt engineering. Claude-Imagine is TypeScript end-to-end, with a pluggable backend architecture that makes it straightforward to add support for new image generation servers.

> See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development guide, project structure, and how to extend.

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/getting-started.md) | Install, configure, verify, generate your first image |
| [Architecture](docs/architecture.md) | Module map, generation flow, backend abstraction, config chain |
| [Image Reference](docs/image-reference.md) | All types, styles, moods, compositions, lighting, palettes |
| [Contributing](CONTRIBUTING.md) | Development setup, project structure, how to extend |
| [Changelog](CHANGELOG.md) | Release history |

---

## 📜 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
