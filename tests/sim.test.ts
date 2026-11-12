import { describe, it, expect } from 'vitest';
import { autoplay } from './helpers';
import { MODES } from '../src/data/modes';

describe('every mode runs to completion with CPU autoplay', () => {
  for (const mode of MODES) {
    it(mode.id, () => {
      const { w } = autoplay(mode.id, 7, mode.duration + 200);
      expect(w.over, `${mode.id} did not finish`).not.toBeNull();
      expect(['win', 'loss', 'draw']).toContain(w.over!.outcome);
      const totalDamage = w.fighters.reduce((a, f) => a + f.stats.damage, 0);
      expect(totalDamage).toBeGreaterThan(0);
      for (const f of w.fighters) { expect(Number.isFinite(f.x)).toBe(true); expect(Number.isFinite(f.hp)).toBe(true); }
    }, 60000);
  }
});
