# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in Claude-Imagine, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email the maintainer or use [GitHub Security Advisories](https://github.com/prenats/claude-imagine/security/advisories/new)
3. Include steps to reproduce and potential impact
4. Allow reasonable time for a fix before public disclosure

## Security Design

- Claude-Imagine communicates only with a **local** image generation server (ComfyUI). It does not make external API calls or require API keys.
- Generated images are written to the working directory. Output paths are validated to prevent directory traversal.
- Configuration files are stored at `~/.config/claude-imagine/` and contain no secrets.
- The MCP server runs as a child process of Claude Code over stdio — it has no network listeners of its own.
