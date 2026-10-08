import { describe, expect, it, vi } from 'vitest';
import { LatencyHistory, sparklineSvg } from '../../src/latencyHistory';

describe('LatencyHistory', () => {
  it('keeps a per-server ring of last N samples', () => {
    const hist = new LatencyHistory(3);
    hist.push('a', 10);
    hist.push('a', 20);
    hist.push('a', 30);
    hist.push('a', 40);
    expect(hist.get('a')).toEqual([20, 30, 40]);
    expect(hist.get('missing')).toEqual([]);
  });

  it('ignores non-finite / negative samples', () => {
    const hist = new LatencyHistory();
    hist.push('a', Number.NaN);
    hist.push('a', -1);
    hist.push('a', 5);
    expect(hist.get('a')).toEqual([5]);
  });

  it('snapshot returns copies per server', () => {
    const hist = new LatencyHistory();
    hist.push('a', 1);
    hist.push('b', 2);
    const snap = hist.snapshot();
    expect(snap).toEqual({ a: [1], b: [2] });
    snap.a.push(99);
    expect(hist.get('a')).toEqual([1]);
  });

  it('invokes optional onChange callback', () => {
    const onChange = vi.fn();
    const hist = new LatencyHistory(40, onChange);
    hist.push('x', 12);
    expect(onChange).toHaveBeenCalledWith('x', [12]);
  });

  it('clear removes one or all servers', () => {
    const hist = new LatencyHistory();
    hist.push('a', 1);
    hist.push('b', 2);
    hist.clear('a');
    expect(hist.get('a')).toEqual([]);
    expect(hist.get('b')).toEqual([2]);
    hist.clear();
    expect(hist.serverCount()).toBe(0);
  });
});

describe('sparklineSvg', () => {
  it('returns empty string for fewer than 2 samples', () => {
    expect(sparklineSvg([])).toBe('');
    expect(sparklineSvg([10])).toBe('');
  });

  it('builds an SVG polyline', () => {
    const svg = sparklineSvg([10, 20, 15], 64, 16);
    expect(svg).toContain('<svg');
    expect(svg).toContain('<polyline');
    expect(svg).toContain('points=');
  });
});
