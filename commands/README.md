# ⌨️ Commands

Commands map slash-command invocations to skills. Each command file mirrors its corresponding skill but uses the full `claude-imagine:` prefix.

> Installed automatically by `npx claude-imagine@latest`.

---

## Shipped Commands

| Command | Skill | Description |
|---------|-------|-------------|
| [`/claude-imagine:image-generate`](claude-imagine/image-generate.md) | image-generate | AI-powered image generation with prompt engineering |
| [`/claude-imagine:image-suggest`](claude-imagine/image-suggest.md) | image-suggest | Project image planning and visual asset strategy |

---

## Adding a New Command

See [CONTRIBUTING.md](../CONTRIBUTING.md#%EF%B8%8F-adding-a-command) for file location and conventions.

```
commands/claude-imagine/<command-name>.md
```
