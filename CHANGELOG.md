# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.0] - 2026-06-21

### Added

- **Cursor / Composer support** — interactive setup can target Claude Code, Cursor, or both. Installs `.cursor/mcp.json` and `image-generation.mdc` agent rule.
- **Bearer token auth** — `IMAGINE_SERVER_TOKEN` and `server.token` in config for authenticated gateways (e.g. NervSys bared nginx).
- **TLS insecure mode** — `IMAGINE_TLS_INSECURE` and `server.tlsInsecure` for internal/self-signed PKI certificates.
- **`verifyServerConnection`** — shared health check with auth and TLS options used by setup and `check`.
- **`config.bared.example.json`** — example config for NervSys bared ComfyUI gateway.
- **Docs** — [Cursor setup](docs/cursor.md) and [NervSys firewall](docs/nervsys-firewall.md).

### Changed

- Setup CLI prompts for IDE target (Claude Code / Cursor / Both) before scope selection.
- `check` reports Cursor MCP registration and rule installation status.
- ComfyUI client uses shared server transport for authenticated requests.

---

## [0.2.0] - 2026-04-13

### Added

- **Model pinning** (`pinnedModels`) — pin specific models for generation so non-generation models on the server (feature extractors, colorizers, relighting models, etc.) are ignored. When `pinnedModels` is set in config, only those models are used for tier resolution, image type assignment, and fallback selection.
- **Model selection step during setup** — the interactive installer (both `npx` and `install.sh`) now asks which models to include for generation before assigning quality tiers. Unselected models are still stored in config but excluded via `pinnedModels`.
- **`reconfigure` CLI command** — re-select which models to pin and reassign tiers without running a full reinstall. Run `npx claude-imagine reconfigure` or `claude-imagine reconfigure`.
- **`getActiveModels()` helper** in config module — filters `CONFIG.models` by `pinnedModels` for use in prompt resolution and generation validation.

### Fixed

- **Wrong models used for generation** — when the ComfyUI server had non-generation models installed (DINOv2, ICLight, ddcolor, qwen, etc.), the system discovered all of them and assigned them to image types. The first model per tier was used regardless of whether it could actually generate images. `pinnedModels` prevents this.
- **Image type assignment during setup** — tier-to-image-type mapping now only considers selected/pinned models, preventing non-generation models from being assigned to image types.

### Changed

- `buildConfig()` in setup-core now accepts an optional `selectedModelIds` parameter. When provided, it emits `pinnedModels` in the config and uses only selected models for tier assignment.
- `setup.ts` (install.sh helper) now accepts `SELECTED:id1,id2,...` on stdin alongside tier assignments.
- `prompt-builder.ts` uses `getActiveModels(CONFIG)` instead of `CONFIG.models` directly.
- `generate.ts` validates against active (pinned) models, not all models.

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

[0.3.0]: https://github.com/prenats/claude-imagine/releases/tag/v0.3.0
[0.2.0]: https://github.com/prenats/claude-imagine/releases/tag/v0.2.0
[0.1.0]: https://github.com/prenats/claude-imagine/releases/tag/v0.1.0
