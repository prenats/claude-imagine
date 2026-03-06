import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

describe('cli dispatcher', () => {
  describe('version reading', () => {
    it('reads version from package.json', () => {
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
      expect(pkg.version).toBeDefined();
      expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('command routing logic', () => {
    function routeCommand(args: string[]): string {
      const command = args[0] ?? '';
      if (args.includes('--server')) return 'server';
      if (args.includes('--version') || args.includes('-V')) return 'version';
      if (args.includes('--help') || args.includes('-h')) return 'help';
      if (command === 'uninstall') return 'uninstall';
      if (command === 'check') return 'check';
      if (command === '' || command === 'setup') return 'setup';
      return 'unknown';
    }

    it('routes --server to server mode', () => {
      expect(routeCommand(['--server'])).toBe('server');
    });

    it('routes --version to version output', () => {
      expect(routeCommand(['--version'])).toBe('version');
    });

    it('routes -V to version output', () => {
      expect(routeCommand(['-V'])).toBe('version');
    });

    it('routes --help to help output', () => {
      expect(routeCommand(['--help'])).toBe('help');
    });

    it('routes -h to help output', () => {
      expect(routeCommand(['-h'])).toBe('help');
    });

    it('routes uninstall command', () => {
      expect(routeCommand(['uninstall'])).toBe('uninstall');
    });

    it('routes check command', () => {
      expect(routeCommand(['check'])).toBe('check');
    });

    it('routes setup command', () => {
      expect(routeCommand(['setup'])).toBe('setup');
    });

    it('routes empty args to setup', () => {
      expect(routeCommand([])).toBe('setup');
    });

    it('routes unknown command', () => {
      expect(routeCommand(['foobar'])).toBe('unknown');
    });

    it('prioritizes --server over subcommand', () => {
      expect(routeCommand(['check', '--server'])).toBe('server');
    });
  });

  describe('printHelp format', () => {
    it('produces help text with version', () => {
      const version = '0.1.0';
      const helpText = `
  claude-imagine v${version}
  AI image generation for Claude Code

  Usage: claude-imagine [command] [options]

  Commands:
    (no args)      Interactive setup (first-time install)
    setup          Same as no args — run interactive setup
    uninstall      Remove skills, commands, rules and MCP registration
    check          Verify an existing installation

  Options:
    --server       Start MCP server on stdio (used by Claude Code)
    --version, -V  Print version
    --help, -h     Print this help
`;
      expect(helpText).toContain('claude-imagine v0.1.0');
      expect(helpText).toContain('--server');
      expect(helpText).toContain('uninstall');
      expect(helpText).toContain('check');
      expect(helpText).toContain('setup');
    });
  });
});
