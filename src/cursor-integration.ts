/**
 * Cursor IDE integration — MCP registration and agent rules.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { PACKAGE_ROOT } from './asset-resolver.js';

export type CursorScope = 'global' | 'local';

export interface CursorMcpEnv {
  readonly serverUrl: string;
  readonly serverToken?: string;
  readonly tlsInsecure?: boolean;
  readonly configPath?: string;
}

export interface CursorInstallResult {
  readonly mcpPath: string;
  readonly rulePath: string;
}

interface McpJson {
  mcpServers?: Record<string, {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    type?: string;
  }>;
}

function cursorDir(scope: CursorScope, projectDir: string): string {
  return scope === 'global'
    ? join(homedir(), '.cursor')
    : join(projectDir, '.cursor');
}

function resolveMcpCommand(): { command: string; args: string[] } {
  const localCli = join(PACKAGE_ROOT, 'dist', 'cli.js');
  if (existsSync(localCli)) {
    return { command: process.execPath, args: [localCli, '--server'] };
  }
  return { command: 'npx', args: ['-y', 'claude-imagine@latest', '--server'] };
}

function buildMcpEnv(env: CursorMcpEnv): Record<string, string> {
  const out: Record<string, string> = {
    IMAGINE_SERVER_URL: env.serverUrl,
  };
  if (env.serverToken) {
    out['IMAGINE_SERVER_TOKEN'] = env.serverToken;
  }
  if (env.tlsInsecure) {
    out['IMAGINE_TLS_INSECURE'] = '1';
  }
  if (env.configPath) {
    out['IMAGINE_CONFIG'] = env.configPath;
  }
  return out;
}

/** Merge claude-imagine into an existing .cursor/mcp.json without clobbering other servers. */
export function writeCursorMcpJson(
  scope: CursorScope,
  projectDir: string,
  env: CursorMcpEnv,
): string {
  const dir = cursorDir(scope, projectDir);
  mkdirSync(dir, { recursive: true });
  const mcpPath = join(dir, 'mcp.json');

  let existing: McpJson = {};
  if (existsSync(mcpPath)) {
    try {
      existing = JSON.parse(readFileSync(mcpPath, 'utf-8')) as McpJson;
    } catch {
      existing = {};
    }
  }

  const { command, args } = resolveMcpCommand();
  const mcpServers = existing.mcpServers ?? {};
  mcpServers['claude-imagine'] = {
    command,
    args,
    env: buildMcpEnv(env),
  };

  writeFileSync(mcpPath, JSON.stringify({ mcpServers }, null, 2) + '\n');
  return mcpPath;
}

export function installCursorRule(scope: CursorScope, projectDir: string): string {
  const src = join(PACKAGE_ROOT, 'cursor', 'rules', 'image-generation.mdc');
  const destDir = join(cursorDir(scope, projectDir), 'rules');
  mkdirSync(destDir, { recursive: true });
  const dest = join(destDir, 'image-generation.mdc');
  copyFileSync(src, dest);
  return dest;
}

export function installCursorIntegration(
  scope: CursorScope,
  projectDir: string,
  env: CursorMcpEnv,
): CursorInstallResult {
  return {
    mcpPath: writeCursorMcpJson(scope, projectDir, env),
    rulePath: installCursorRule(scope, projectDir),
  };
}

export function cursorMcpPath(scope: CursorScope, projectDir: string): string {
  return join(cursorDir(scope, projectDir), 'mcp.json');
}

export function hasCursorMcpRegistration(scope: CursorScope, projectDir: string): boolean {
  const path = cursorMcpPath(scope, projectDir);
  if (!existsSync(path)) return false;
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8')) as McpJson;
    return Boolean(data.mcpServers?.['claude-imagine']);
  } catch {
    return false;
  }
}

export function hasCursorRule(scope: CursorScope, projectDir: string): boolean {
  return existsSync(join(cursorDir(scope, projectDir), 'rules', 'image-generation.mdc'));
}

/** Default NervSys bared ComfyUI gateway URL (override during setup). */
export const DEFAULT_BARED_COMFY_URL = 'https://bared.mngm.nexusecurus.lab/comfy';
