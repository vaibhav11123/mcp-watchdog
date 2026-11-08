import { describe, expect, it } from 'vitest';
import { escapeMarkdownPlain } from '../../src/ui/markdownEscape';

describe('escapeMarkdownPlain', () => {
  it('neutralizes command URI markdown links', () => {
    const raw = '[x](command:workbench.action.quit)';
    const escaped = escapeMarkdownPlain(raw);
    expect(escaped).not.toContain('[x](');
    expect(escaped).toContain('\\[x\\]');
    expect(escaped).toContain('\\(command:workbench.action.quit\\)');
  });

  it('escapes backticks that could break fences', () => {
    expect(escapeMarkdownPlain('err ``` evil')).toContain('\\`\\`\\`');
  });

  it('escapes angle brackets', () => {
    expect(escapeMarkdownPlain('<script>')).toBe('&lt;script&gt;');
  });
});
