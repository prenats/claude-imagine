# 📏 Rules

Rules are always-loaded guidelines that Claude follows automatically in every session where Claude-Imagine is active. They enforce behavior rather than teach workflows.

> Installed automatically by `npx claude-imagine@latest`.

---

## Shipped Rules

| Rule | Category | Description |
|------|----------|-------------|
| [image-generation](image/image-generation.md) | image | Enforces `/image-generate` skill usage, bans placeholder services, defines image type tiers |

---

## Rules vs Skills

| Aspect | Rule | Skill |
|--------|------|-------|
| Activation | Always loaded | Invoked on demand |
| Purpose | Enforce constraints | Teach a workflow |
| Tone | Declarative ("ALWAYS do X") | Procedural ("Step 1, Step 2...") |

---

## Adding a New Rule

See [CONTRIBUTING.md](../CONTRIBUTING.md#-adding-a-rule) for file location, naming, and conventions.

```
rules/<category>/<rule-name>.md
```
