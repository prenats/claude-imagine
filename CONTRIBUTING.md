# 🤝 Contributing to Claude-Imagine

We welcome contributions! This guide covers development setup, project structure, and how to extend the project.

---

## 🏁 Development Setup

```bash
git clone https://github.com/prenats/claude-imagine.git
cd claude-imagine
npm install
npm run build
npm test
```

Install from source for local testing:

```bash
./install.sh
```

---

## 📂 Project Structure

```
src/
  cli.ts                CLI dispatcher
  cli-ui.ts             Terminal UI helpers
  index.ts              MCP server and tool definitions
  generate.ts           Generation orchestrator
  prompt-builder.ts     Prompt resolution
  negative-prompts.ts   Negative prompt assembly
  image-types.ts        Image type definitions
  models.ts             TypeScript types and enums
  config.ts             Config loading
  errors.ts             Error types
  setup.ts              Backend detection entry point
  setup-cli.ts          Interactive setup workflow
  setup-core.ts         Pure detection logic
  uninstall-cli.ts      Uninstall workflow
  check-cli.ts          Installation verification
  asset-resolver.ts     Bundled asset path resolution
  backends/
    types.ts            ImageBackend interface
    registry.ts         Backend registry
    detect.ts           Auto-detection
    comfyui/
      index.ts          ComfyUI implementation
      client.ts         HTTP client
      workflows.ts      Workflow builders
      discover.ts       Model discovery
      defaults.ts       Default params

skills/                 Skill definitions (SKILL.md files)
commands/               Command definitions
rules/                  Always-loaded rules
tests/                  Unit tests (vitest)
docs/                   Documentation
```

---

## 🎨 Adding a Skill

Skills live in `skills/claude-imagine/<skill-name>/SKILL.md`.

### Required Frontmatter

```yaml
---
name: <skill-name>
description: One-line summary.
origin: claude-imagine
---
```

### Required Sections

| Section | Purpose |
|---------|---------|
| **When to Activate** | Trigger conditions (user phrases, file patterns, project context) |
| **Usage** | 3-4 example invocations with different flags |
| **Argument Parsing** | All flags with types, defaults, descriptions |
| **Workflow** | Step-by-step procedure |
| **Quality Gate** | Checklist of conditions before delivering |
| **Anti-Patterns** | Common mistakes to avoid |

> Keep skills under 500 lines. Every skill needs a matching command file.

---

## ⌨️ Adding a Command

Commands live in `commands/claude-imagine/<command-name>.md`. The command name should match its skill name.

Command files mirror the skill content but use the full prefix in examples:

```
/claude-imagine:image-generate ...
```

---

## 📏 Adding a Rule

Rules live in `rules/<category>/<rule-name>.md`.

| Aspect | Rule | Skill |
|--------|------|-------|
| Activation | Always loaded | Invoked on demand |
| Purpose | Enforce constraints | Teach a workflow |
| Tone | Declarative ("ALWAYS do X") | Procedural ("Step 1, Step 2...") |
| Length | Short (< 100 lines) | Longer (100-500 lines) |

---

## 🔌 Adding an MCP Tool

1. Define a zod schema for input validation in `src/index.ts`
2. Implement the handler (or create a new module if complex)
3. Register the tool in the MCP server's tool list
4. Add tests in `tests/<tool-name>.test.ts`
5. Update the MCP Tools table in `README.md`

> **Conventions:** Tool names use `snake_case`. All parameters must have zod validation. Return structured results, not raw strings. Include error handling with actionable messages.

---

## 🧩 Adding a Backend

1. Create `src/backends/<name>/index.ts` implementing `ImageBackend`
2. Call `registerBackend()` to self-register on import
3. Add discovery, workflow, and client modules as needed
4. Import the backend in `src/index.ts` so it registers at startup

---

## 🧪 Running Tests

```bash
npm test              # Run all tests
npm run test:coverage # Run with coverage report
```

Tests use [vitest](https://vitest.dev/) and do not require a running server.

---

## 📝 Commit Messages

```
<type>: <description>
```

| Type | Use For |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `chore` | Build process, dependencies, etc. |
| `perf` | Performance improvement |
| `ci` | CI/CD changes |

**Examples:**

```
feat: add /image-brand skill for brand identity generation
fix: handle server timeout on large batch generations
docs: update architecture diagram with new backend
test: add unit tests for Flux workflow builder
```

---

## 📁 File Naming

| Component | Convention | Example |
|-----------|-----------|---------|
| Skills | `skills/claude-imagine/<name>/SKILL.md` | `skills/claude-imagine/image-generate/SKILL.md` |
| Commands | `commands/claude-imagine/<name>.md` | `commands/claude-imagine/image-generate.md` |
| Rules | `rules/<category>/<name>.md` | `rules/image/image-generation.md` |
| Source | `src/<name>.ts` | `src/generate.ts` |
| Tests | `tests/<name>.test.ts` | `tests/generate.test.ts` |

> Always use lowercase hyphenated names.
