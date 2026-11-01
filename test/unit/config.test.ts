import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({}));

import { claudeDesktopMcpPath } from '../../src/config';
import { mergeConfigLayers } from '../../src/config-core';

describe('claudeDesktopMcpPath', () => {
  const home = '/Users/tester';

  it('darwin', () => {
    expect(claudeDesktopMcpPath(home, 'darwin')).toBe(
      path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    );
  });

  it('win32', () => {
    expect(claudeDesktopMcpPath(home, 'win32')).toBe(
      path.join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json'),
    );
  });

  it('linux', () => {
    expect(claudeDesktopMcpPath(home, 'linux')).toBe(
      path.join(home, '.config', 'Claude', 'claude_desktop_config.json'),
    );
  });
});

describe('mergeConfigLayers origins', () => {
  it('later layer wins path in origins', () => {
    const globalPath = '/global/mcp.json';
    const projectPath = '/proj/.cursor/mcp.json';
    const { merged, origins } = mergeConfigLayers([
      {
        label: 'global',
        path: globalPath,
        servers: { shared: { type: 'stdio', command: 'global-cmd' } },
      },
      {
        label: 'project',
        path: projectPath,
        servers: { shared: { type: 'stdio', command: 'project-cmd' } },
      },
    ]);
    expect(merged.shared.command).toBe('project-cmd');
    expect(origins.shared).toEqual({ label: 'project', path: projectPath });
  });
});
