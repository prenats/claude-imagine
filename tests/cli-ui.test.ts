import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Readable, Writable } from 'node:stream';

const originalIsTTY = process.stdout.isTTY;

describe('cli-ui', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    process.stdout.isTTY = originalIsTTY;
  });

  describe('colors', () => {
    it('exports color codes with expected keys', async () => {
      const { colors } = await import('../src/cli-ui.js');
      expect(colors).toHaveProperty('red');
      expect(colors).toHaveProperty('green');
      expect(colors).toHaveProperty('yellow');
      expect(colors).toHaveProperty('blue');
      expect(colors).toHaveProperty('cyan');
      expect(colors).toHaveProperty('dim');
      expect(colors).toHaveProperty('bold');
      expect(colors).toHaveProperty('reset');
    });
  });

  describe('step', () => {
    it('prints a green + prefix', async () => {
      const { step, colors } = await import('../src/cli-ui.js');
      step('test message');
      expect(consoleSpy).toHaveBeenCalledWith(
        `  ${colors.green}+${colors.reset} test message`,
      );
    });
  });

  describe('warn', () => {
    it('prints a yellow ! prefix', async () => {
      const { warn, colors } = await import('../src/cli-ui.js');
      warn('warning message');
      expect(consoleSpy).toHaveBeenCalledWith(
        `  ${colors.yellow}!${colors.reset} warning message`,
      );
    });
  });

  describe('fail', () => {
    it('prints a red x prefix', async () => {
      const { fail, colors } = await import('../src/cli-ui.js');
      fail('fail message');
      expect(consoleSpy).toHaveBeenCalledWith(
        `  ${colors.red}x${colors.reset} fail message`,
      );
    });
  });

  describe('header', () => {
    it('prints bold text with leading newline', async () => {
      const { header, colors } = await import('../src/cli-ui.js');
      header('Section');
      expect(consoleSpy).toHaveBeenCalledWith(
        `\n  ${colors.bold}Section${colors.reset}`,
      );
    });
  });

  describe('detail', () => {
    it('prints dim indented text', async () => {
      const { detail, colors } = await import('../src/cli-ui.js');
      detail('some detail');
      expect(consoleSpy).toHaveBeenCalledWith(
        `    ${colors.dim}some detail${colors.reset}`,
      );
    });
  });

  describe('printLine', () => {
    it('prints a dim horizontal line', async () => {
      const { printLine, colors } = await import('../src/cli-ui.js');
      printLine();
      expect(consoleSpy).toHaveBeenCalledWith(
        `  ${colors.dim}${'─'.repeat(50)}${colors.reset}`,
      );
    });
  });

  describe('printBanner', () => {
    it('prints the banner with version', async () => {
      const { printBanner, colors } = await import('../src/cli-ui.js');
      printBanner('1.2.3');
      expect(consoleSpy).toHaveBeenCalledWith(
        `  ${colors.bold}claude-imagine${colors.reset} ${colors.dim}v1.2.3${colors.reset}`,
      );
    });
  });

  describe('getVersion', () => {
    it('returns a valid semver-like string', async () => {
      const { getVersion } = await import('../src/cli-ui.js');
      const version = getVersion();
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('prompt', () => {
    it('returns user input', async () => {
      const { prompt } = await import('../src/cli-ui.js');
      // Create a readable stream that provides input
      const input = new Readable({ read() {} });
      const output = new Writable({ write(_chunk, _enc, cb) { cb(); } });

      // Override stdin/stdout temporarily
      const origStdin = process.stdin;
      const origStdout = process.stdout;
      Object.defineProperty(process, 'stdin', { value: input, writable: true });
      Object.defineProperty(process, 'stdout', { value: output, writable: true });

      const promise = prompt('Enter value', 'default');
      // Push input after a tick to allow readline to initialize
      setImmediate(() => input.push('custom\n'));

      const result = await promise;
      expect(result).toBe('custom');

      Object.defineProperty(process, 'stdin', { value: origStdin, writable: true });
      Object.defineProperty(process, 'stdout', { value: origStdout, writable: true });
    });

    it('returns default value when input is empty', async () => {
      const { prompt } = await import('../src/cli-ui.js');
      const input = new Readable({ read() {} });
      const output = new Writable({ write(_chunk, _enc, cb) { cb(); } });

      const origStdin = process.stdin;
      const origStdout = process.stdout;
      Object.defineProperty(process, 'stdin', { value: input, writable: true });
      Object.defineProperty(process, 'stdout', { value: output, writable: true });

      const promise = prompt('Enter value', 'fallback');
      setImmediate(() => input.push('\n'));

      const result = await promise;
      expect(result).toBe('fallback');

      Object.defineProperty(process, 'stdin', { value: origStdin, writable: true });
      Object.defineProperty(process, 'stdout', { value: origStdout, writable: true });
    });
  });

  describe('promptChoice', () => {
    it('returns valid choice', async () => {
      const { promptChoice } = await import('../src/cli-ui.js');
      const input = new Readable({ read() {} });
      const output = new Writable({ write(_chunk, _enc, cb) { cb(); } });

      const origStdin = process.stdin;
      const origStdout = process.stdout;
      Object.defineProperty(process, 'stdin', { value: input, writable: true });
      Object.defineProperty(process, 'stdout', { value: output, writable: true });

      const promise = promptChoice('Choose: ', ['1', '2']);
      setImmediate(() => input.push('1\n'));

      const result = await promise;
      expect(result).toBe('1');

      Object.defineProperty(process, 'stdin', { value: origStdin, writable: true });
      Object.defineProperty(process, 'stdout', { value: origStdout, writable: true });
    });

    it('re-prompts on invalid choice then accepts valid', async () => {
      const { promptChoice } = await import('../src/cli-ui.js');
      const input = new Readable({ read() {} });
      const output = new Writable({ write(_chunk, _enc, cb) { cb(); } });

      const origStdin = process.stdin;
      const origStdout = process.stdout;
      Object.defineProperty(process, 'stdin', { value: input, writable: true });
      Object.defineProperty(process, 'stdout', { value: output, writable: true });

      const promise = promptChoice('Choose: ', ['1', '2']);
      // First push invalid, then valid
      setImmediate(() => {
        input.push('3\n');
        setImmediate(() => input.push('2\n'));
      });

      const result = await promise;
      expect(result).toBe('2');

      Object.defineProperty(process, 'stdin', { value: origStdin, writable: true });
      Object.defineProperty(process, 'stdout', { value: origStdout, writable: true });
    });
  });
});
