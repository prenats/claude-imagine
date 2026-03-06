/**
 * Terminal UI helpers for CLI scripts — colors, prompts, and formatted output.
 */

import * as readline from 'node:readline';
import { createRequire } from 'node:module';

const isTTY = process.stdout.isTTY ?? false;

export const colors = {
  red: isTTY ? '\x1b[0;31m' : '',
  green: isTTY ? '\x1b[0;32m' : '',
  yellow: isTTY ? '\x1b[0;33m' : '',
  blue: isTTY ? '\x1b[0;34m' : '',
  cyan: isTTY ? '\x1b[0;36m' : '',
  dim: isTTY ? '\x1b[2m' : '',
  bold: isTTY ? '\x1b[1m' : '',
  reset: isTTY ? '\x1b[0m' : '',
} as const;

export function step(msg: string): void {
  console.log(`  ${colors.green}+${colors.reset} ${msg}`);
}

export function warn(msg: string): void {
  console.log(`  ${colors.yellow}!${colors.reset} ${msg}`);
}

export function fail(msg: string): void {
  console.log(`  ${colors.red}x${colors.reset} ${msg}`);
}

export function header(msg: string): void {
  console.log(`\n  ${colors.bold}${msg}${colors.reset}`);
}

export function detail(msg: string): void {
  console.log(`    ${colors.dim}${msg}${colors.reset}`);
}

export function printLine(): void {
  console.log(`  ${colors.dim}${'─'.repeat(50)}${colors.reset}`);
}

export function printBanner(version: string): void {
  console.log('');
  console.log(`  ${colors.bold}claude-imagine${colors.reset} ${colors.dim}v${version}${colors.reset}`);
  console.log(`  ${colors.dim}AI image generation for Claude Code${colors.reset}`);
  console.log('');
}

export function getVersion(): string {
  const require = createRequire(import.meta.url);
  const pkg = require('../package.json');
  return pkg.version as string;
}

export function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const suffix = defaultValue
    ? ` [${colors.cyan}${defaultValue}${colors.reset}]: `
    : ': ';

  return new Promise<string>((resolve) => {
    rl.question(`  ${question}${suffix}`, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

export function promptNumberedList(
  question: string,
  items: ReadonlyArray<string>,
  defaultIndex?: number,
): Promise<number> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  for (let i = 0; i < items.length; i++) {
    const marker = i === defaultIndex ? `${colors.green}*${colors.reset}` : ' ';
    console.log(`   ${marker}${colors.cyan}${i + 1}${colors.reset}  ${items[i]}`);
  }
  console.log('');

  const defaultHint = defaultIndex !== undefined ? ` [${defaultIndex + 1}]` : '';

  return new Promise<number>((resolve) => {
    const ask = (): void => {
      rl.question(`  ${question}${defaultHint}: `, (answer) => {
        const trimmed = answer.trim();
        if (trimmed === '' && defaultIndex !== undefined) {
          rl.close();
          resolve(defaultIndex);
          return;
        }
        const num = parseInt(trimmed, 10);
        if (num >= 1 && num <= items.length) {
          rl.close();
          resolve(num - 1);
        } else {
          console.log(`    ${colors.dim}Enter 1–${items.length}${colors.reset}`);
          ask();
        }
      });
    };
    ask();
  });
}

export function promptChoice(question: string, choices: string[]): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<string>((resolve) => {
    const ask = (): void => {
      rl.question(`  ${question}`, (answer) => {
        const trimmed = answer.trim();
        if (choices.includes(trimmed)) {
          rl.close();
          resolve(trimmed);
        } else {
          console.log(`    ${colors.dim}Enter ${choices.join(' or ')}${colors.reset}`);
          ask();
        }
      });
    };
    ask();
  });
}
