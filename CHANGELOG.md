# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-03-06

Initial release.

### 🔌 MCP Server

- 4 tools: `generate_image`, `batch_generate`, `list_capabilities`, `check_server`
- stdio transport for Claude Code integration
- Zod-validated input schemas on all tools
- Batch generation capped at 50 images per request

### 🎨 Image Generation

- 11 image types with per-type defaults for dimensions, style, mood, composition, lighting
- 15 styles, 12 moods, 12 compositions, 12 lighting options, 8 color palettes
- 3 quality tiers (fast, standard, high) mapped to discovered models
- Smart negative prompt generation per type and style (SDXL only)
- Batch generation with sequential GPU execution and per-image reporting
- Seed support for reproducible generation
- Custom width/height overrides (64–1536, rounded to nearest 8)

### 🧩 Backend Abstraction

- Pluggable `ImageBackend` interface with registry and auto-detection
- ComfyUI backend with SDXL and Flux workflow builders (Flux CLIP/VAE filenames configurable via model params)
- Automatic model discovery from ComfyUI loader nodes (folder fallback)
- Default params and time estimates derived from filename heuristics

### ⌨️ CLI

- `npx claude-imagine@latest` — interactive setup with scope selection
- `npx claude-imagine --server` — start MCP server (used by MCP registration)
- `npx claude-imagine check` — verify installation
- `npx claude-imagine uninstall` — remove installed files and MCP registration
- Global and per-project install scope

### 📝 Skills and Rules

- `/claude-imagine:image-generate` — prompt engineering + generation workflow
- `/claude-imagine:image-suggest` — project analysis + batch image planning
- Image generation rule enforcing prompt engineering workflow and banning placeholder services

### ⚙️ Configuration

- Config file at `~/.config/claude-imagine/config.json`
- Priority chain: environment variables > config file > defaults
- Environment variable overrides: `IMAGINE_SERVER_URL`, `IMAGINE_BACKEND`, `IMAGINE_OUTPUT_DIR`, `IMAGINE_CONFIG`
- Auto-detection of ComfyUI server and installed models during setup
- Automatic MCP registration via `claude mcp add`

### 🛡️ Security and Error Handling

- Output path validation — rejects directory traversal and paths outside the working directory
- `ConnectionError`, `TimeoutError`, `GenerationError` with actionable hints
- Invalid image types and missing models throw proper errors (not silent strings)
- OOM detection with resolution reduction suggestion
- 180-second generation timeout with prompt ID in error messages
- Silent config fallback — no stderr output during MCP stdio transport

---

[0.1.0]: https://github.com/prenats/claude-imagine/releases/tag/v0.1.0
