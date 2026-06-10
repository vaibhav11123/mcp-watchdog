import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out-test/test/host/**/*.test.js',
  version: process.env.VSCODE_VERSION || 'stable',
  workspaceFolder: 'mcp-watchdog-test',
  mocha: { timeout: 120_000 },
});
