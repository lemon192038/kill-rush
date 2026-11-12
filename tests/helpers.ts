import { buildMatch } from '../src/meta/match';
import { defaultSave } from '../src/meta/save';
import { createWorld, stepWorld } from '../src/sim/world';
import { makeProfile } from '../src/ai/profile';
import { Rng } from '../src/core/rng';
import type { ModeId } from '../src/data/modes';

/** Run a full match where the "player" is also CPU-driven (autoplay). */
export function autoplay(mode: ModeId, seed = 1, maxSec = 400, charId = 1) {
  const s = defaultSave(); s.selectedChar = charId;
  const m = buildMatch(s, mode, { seed });
  const p = m.cfg.roster.find(r => r.isPlayer)!;
  p.cpu = makeProfile(new Rng(seed), 'ADVANCED', 'STEADY');
  const w = createWorld(m.cfg);
  let ticks = 0;
  while (!w.over && ticks < maxSec * 60) { stepWorld(w); w.events.length = 0; ticks++; }
  return { w, m, ticks };
}
