import { describe, expect, it } from 'vitest';
import { DoctorMetrics } from '../../src/incidentStore';

describe('DoctorMetrics north-star hooks', () => {
  it('diagnoseRate / verifiedResolveRate / falsePositiveRate formulas', () => {
    const m = new DoctorMetrics();
    m.recordDiagnose();
    m.recordDiagnose();
    expect(m.diagnoseRate(4)).toBe(0.5);
    expect(m.diagnoseRate(0)).toBe(0);

    m.recordVerify('resolved');
    m.recordVerify('unresolved');
    expect(m.verifiedResolveRate()).toBe(0.5);

    m.recordFalsePositive();
    // FP ÷ diagnoses (2 diagnoses → 0.5)
    expect(m.falsePositiveRate()).toBeCloseTo(0.5);
  });

  it('does not invent public % — counters only until labeled window', () => {
    const m = new DoctorMetrics();
    expect(m.verifiedResolveRate()).toBe(0);
    expect(m.falsePositiveRate()).toBe(0);
  });
});
