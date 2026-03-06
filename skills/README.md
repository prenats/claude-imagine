# 🎨 Skills

Skills are procedural workflows that Claude follows when invoked via slash commands. Each skill engineers prompts, orchestrates tool calls, and enforces quality gates.

> Installed automatically by `npx claude-imagine@latest`.

---

## Shipped Skills

| Skill | Command | Description |
|-------|---------|-------------|
| [image-generate](claude-imagine/image-generate/SKILL.md) | `/claude-imagine:image-generate` | Transform descriptions into 150-250 word prompts, then generate images |
| [image-suggest](claude-imagine/image-suggest/SKILL.md) | `/claude-imagine:image-suggest` | Analyze a project and recommend 4-8 images with types, styles, and rationale |

---

## Adding a New Skill

See [CONTRIBUTING.md](../CONTRIBUTING.md#-adding-a-skill) for the required structure, frontmatter, and sections.

```
skills/claude-imagine/<skill-name>/SKILL.md
```
