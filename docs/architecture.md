# 🏛️ Architecture

## 📦 Module Map

```
src/
  cli.ts                CLI dispatcher — routes to setup, server, check, or uninstall
  cli-ui.ts             Terminal UI — ANSI colors, prompts, banners, step logging
  index.ts              MCP server — registers 4 tools, loads backend, stdio transport
  generate.ts           Generation orchestrator — validate, build prompt, call backend, save file
  prompt-builder.ts     Prompt resolution — dimensions, model selection, seed, negative prompt
  negative-prompts.ts   Negative prompt assembly — universal + type-specific + style-specific
  image-types.ts        11 image types — default dimensions, style, mood, composition, lighting
  models.ts             TypeScript types — Style, Mood, Composition, Lighting, ModelDefinition
  config.ts             Config loading — env vars > JSON file > defaults
  errors.ts             Error types — ConnectionError, TimeoutError, GenerationError
  setup.ts              Detection entry point — used by install.sh for JSON output
  setup-cli.ts          Interactive setup — scope, prerequisites, copy assets, detect, register MCP
  setup-core.ts         Pure detection — detectAndDiscover(), assignModelsByTier(), buildConfig()
  uninstall-cli.ts      Uninstall — remove assets, deregister MCP
  check-cli.ts          Verification — check skills, commands, rules, config, server
  asset-resolver.ts     Asset paths — resolves bundled files relative to package root
  backends/
    types.ts            ImageBackend interface — detect, discoverModels, generate, checkHealth
    registry.ts         Backend registry — register/lookup pattern
    detect.ts           Auto-detection — probes registered backends, returns first match
    comfyui/
      index.ts          ComfyUI implementation — self-registers on import
      client.ts         HTTP client — queue prompt, poll history, download output (180s timeout)
      workflows.ts      SDXL and Flux workflow builders
      discover.ts       Model discovery from loader nodes or folder fallback
      defaults.ts       Default params and time estimates by filename heuristics
```

---

## 🔀 CLI Dispatcher

`src/cli.ts` is the package entry point (`bin.claude-imagine` in package.json):

| Input | Action |
|-------|--------|
| No args or `setup` | ▶️ Interactive setup (`setup-cli.ts`) |
| `--server` | ▶️ Start MCP server on stdio (`index.ts`) |
| `check` | ▶️ Verify installation (`check-cli.ts`) |
| `uninstall` | ▶️ Remove installed files (`uninstall-cli.ts`) |
| `--version` / `-V` | ▶️ Print version from package.json |
| `--help` / `-h` | ▶️ Print usage help |

This means:
- `npx claude-imagine@latest` runs **setup**
- `npx -y claude-imagine --server` starts the **MCP server** (used by MCP registration)

---

## 🔌 MCP Server

`src/index.ts` creates an MCP server with 4 tools:

| Tool | Handler |
|------|---------|
| `generate_image` | Validate via zod → `generateSingle()` → formatted report |
| `batch_generate` | Iterate images → `generateSingle()` each → collect results |
| `list_capabilities` | Return all enums, image types, discovered models, quality tiers |
| `check_server` | `backend.checkHealth()` → status and backend name |

The server loads the configured backend on startup and communicates over **stdio transport**.

---

## 🔄 Generation Flow

```
User
  │
  ▼
Skill (/claude-imagine:image-generate)
  │  Claude engineers a 150-250 word prompt
  │  Infers type, style, mood, lighting from description
  ▼
MCP Tool (generate_image)
  │  Validates params via zod schema
  ▼
generate.ts
  │  buildPrompt() → { positive, negative, model, width, height, seed }
  │  Resolves model: explicit > quality tier > type default > first available
  ▼
backend.generate(prompt, model, serverUrl)
  │
  ▼
ComfyUI Client (client.ts)
  │  POST /prompt → queue workflow
  │  Poll /history/{id} → wait for completion (1.5s interval, 180s timeout)
  │  GET /view → download output PNG
  ▼
generate.ts
  │  Write PNG to output_path
  │  Return report (path, type, model, dimensions, seed, time, prompt excerpt)
  ▼
User sees result
```

---

## 🧩 Backend Abstraction

The `ImageBackend` interface defines four methods:

```typescript
interface ImageBackend {
  readonly name: string;
  detect(url: string): Promise<boolean>;
  discoverModels(url: string): Promise<ReadonlyArray<DiscoveredModel>>;
  generate(prompt, model, serverUrl): Promise<GenerationResult>;
  checkHealth(url: string): Promise<boolean>;
}
```

Backends self-register via `registerBackend()` in the registry.

### ComfyUI Backend

| Capability | How |
|------------|-----|
| **Detection** | GET `/object_info`, checks for `KSampler` node |
| **Discovery** | Reads loader node input fields (CheckpointLoaderSimple, UNETLoader) or falls back to model folder endpoints |
| **Workflows** | SDXL: checkpoint loader + negative prompt. Flux: UNET loader + DualCLIPLoader + VAELoader (CLIP/VAE configurable per model, selected during setup) |
| **Generation** | Queue via POST `/prompt`, poll `/history/{id}`, download via GET `/view` |

> The architecture supports adding new backends by implementing the interface and calling `registerBackend()`.

---

## ⚙️ Configuration

### Priority Chain

```
1. Environment variables          (highest priority)
2. ~/.config/claude-imagine/config.json
3. Hardcoded defaults             (lowest priority)
```

### Config Structure (JSON file)

```json
{
  "backend": "comfyui",
  "server": { "url": "http://localhost:8188" },
  "models": {
    "<id>": {
      "filename": "model.safetensors",
      "displayName": "Model Name",
      "type": "checkpoint | unet",
      "tier": "fast | standard | high",
      "params": { "steps": 4, "cfg": 1.0, "sampler": "euler", "scheduler": "..." }
    }
  },
  "imageTypes": {
    "ICON": { "model": "<model-id>" }
  },
  "output": { "dir": "generated" }
}
```

> Both `server.url` and flat `serverUrl` are accepted. Both `output.dir` and flat `defaultOutputDir` are accepted. The auto-setup generates the nested format.

### Quality Tier Assignment

During setup, `autoAssignModels()` assigns discovered models to image types by speed:

| Tier | Image Types | Assigned Model |
|------|-------------|---------------|
| ⚡ Fast | ICON, THUMBNAIL, BACKGROUND, TEXTURE | Fastest discovered model |
| ⏱️ Standard | AVATAR, CONTENT, BANNER, PRODUCT | Mid-speed model |
| 🎯 High | LOGO, HERO, FEATURED | Slowest (highest quality) model |

---

## 🔗 Skills, Commands, and Rules

```
📏 Rules (always loaded)
   image-generation.md              "Use the skill, never call generate_image directly"
       │
       ▼
🎨 Skills (invoked on demand)
   image-generate/SKILL.md          Prompt engineering + generation workflow
   image-suggest/SKILL.md           Project analysis + batch planning
       │
       ▼
⌨️  Commands (user-facing entry points)
   image-generate.md                /claude-imagine:image-generate → skill
   image-suggest.md                 /claude-imagine:image-suggest → skill
       │
       ▼
🔌 MCP Tools (server-side execution)
   generate_image                   Send workflow to ComfyUI
   batch_generate                   Sequential multi-image generation
   list_capabilities                Return all enums and models
   check_server                     Verify server connectivity
```

| Layer | Role | Activation |
|-------|------|-----------|
| **Rules** | Enforce behavior | Always active, declarative |
| **Skills** | Teach workflows | Invoked on demand, procedural |
| **Commands** | User-facing triggers | Slash command entry points |
| **MCP Tools** | Server-side execution | Called by skills |
