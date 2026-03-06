import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'dist/**',
        'src/index.ts',      // MCP server entry point (stdio)
        'src/cli.ts',        // CLI dispatcher (dynamic imports)
        'src/setup.ts',      // install.sh bridge (thin wrapper)
        'src/setup-cli.ts',  // Interactive setup (prompts + fs + execSync)
        'src/check-cli.ts',  // Interactive check (prompts + fs + fetch)
        'src/uninstall-cli.ts', // Interactive uninstall (prompts + fs + execSync)
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
