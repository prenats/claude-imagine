# Cursor / Composer setup

claude-imagine works with **Cursor Composer** via MCP — no Claude Code required.

## Quick install

From your project directory:

```bash
npx claude-imagine@latest
```

Choose:

1. **IDE Target** → `2` (Cursor) or `3` (Both)
2. **Scope** → `2` (Local) for per-project, or `1` (Global)
3. **Server URL** → `https://bared.mngm.nexusecurus.lab/comfy`
4. **TLS** → `Y` (internal PKI certificate)
5. **Bearer token** → from OpenBao `secret/bared-llm/api` field `devcode`

Restart Cursor and enable **claude-imagine** in MCP tools for the session.

## What gets installed

| Component | Location |
|-----------|----------|
| MCP server | `.cursor/mcp.json` (or `~/.cursor/mcp.json`) |
| Agent rule | `.cursor/rules/image-generation.mdc` |
| Config | `~/.config/claude-imagine/config.json` |

## Manual MCP registration

Project `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "claude-imagine": {
      "command": "node",
      "args": ["/path/to/claude-imagine/dist/cli.js", "--server"],
      "env": {
        "IMAGINE_SERVER_URL": "https://bared.mngm.nexusecurus.lab/comfy",
        "IMAGINE_SERVER_TOKEN": "<devcode token from OpenBao>",
        "IMAGINE_TLS_INSECURE": "1"
      }
    }
  }
}
```

See `config.bared.example.json` for a full model config after discovery.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `IMAGINE_SERVER_URL` | ComfyUI base URL (include `/comfy` path prefix for bared) |
| `IMAGINE_SERVER_TOKEN` | Bearer token for nginx gateway |
| `IMAGINE_TLS_INSECURE` | `1` to trust internal self-signed PKI |
| `IMAGINE_CONFIG` | Override config file path |

## Verify

```bash
npx claude-imagine check
```

## NervSys bared (devcode-1 → bared)

- ComfyUI runs on bared GPU; devcode reaches it via **HTTPS :443** only (not `:8188`).
- Firewall: devcode `10.0.100.100` → bared `10.0.254.10:443` TCP (already allowed on bared UFW + Proxmox `ns_bared_llm_acc`).
- No firewall change needed for `:8188` — keep ComfyUI localhost-only.

Deploy models on bared:

```bash
ansible-playbook playbooks/19-bared.yml --tags comfyui,models
```

Bearer token:

```bash
bao kv get secret/bared-llm/api
```
