import { describe, expect, it } from 'vitest';
import type { Activity } from '../src/content/schema.ts';
import { checkParallel, isBusyNearbyCompatible } from '../src/lib/supervision.ts';
import { loadFixture } from './helpers.ts';

const f = loadFixture();
const tummy = f.activities.find((a) => a.id === 'act.fixture-floor-tummy-time')!;
const books = f.activities.find((a) => a.id === 'act.fixture-board-book-basket')!;

function track(patch: Partial<Activity['supervision']> & { hazards?: Activity['hazards']; places?: Activity['places']; outing?: boolean; title?: string }) {
  const { hazards, places, outing, title, ...sup } = patch;
  return {
    title: title ?? 'Track',
    supervision: { ...books.supervision, ...sup },
    hazards: hazards ?? [],
    places: places ?? ['indoors' as const],
    outing: outing ?? false,
  };
}

describe('one-adult parallel feasibility', () => {
  it('allows floor tummy time beside a watched book basket', () => {
    expect(checkParallel(tummy, books, 1)).toEqual({ ok: true, reasons: [] });
  });

  it('rejects the known impossible pair: two activities that each need your hands the whole time', () => {
    const holdBaby = track({ title: 'Chest tummy time', proximity: 'holding', handsOn: 'continuous', participation: 'leads' });
    const spotClimber = track({ title: 'Spotting a climber', proximity: 'arms-reach', handsOn: 'continuous', participation: 'joins' });
    const r = checkParallel(holdBaby, spotClimber, 1);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/hands the whole time/);
    expect(r.reasons.join(' ')).toMatch(/arm’s reach/);
  });

  it('rejects anything beside water, heat, food, or traffic', () => {
    for (const hazard of ['water', 'heat', 'food', 'traffic'] as const) {
      const r = checkParallel(tummy, track({ title: hazard, hazards: [hazard] }), 1);
      expect(r.ok, hazard).toBe(false);
    }
  });

  it('rejects unshareable activities, two-adult activities, two led activities, and split locations', () => {
    expect(checkParallel(tummy, track({ shareable: false }), 1).ok).toBe(false);
    expect(checkParallel(tummy, track({ minAdults: 2 }), 1).ok).toBe(false);
    expect(checkParallel(tummy, track({ participation: 'leads' }), 1).ok).toBe(false);
    expect(checkParallel(tummy, track({ places: ['outdoors'] }), 1).ok).toBe(false);
    expect(checkParallel(tummy, track({ outing: true }), 1).ok).toBe(false);
  });

  it('with two adults, each child can have their own adult', () => {
    const holdBaby = track({ proximity: 'holding', handsOn: 'continuous', participation: 'leads' });
    expect(checkParallel(holdBaby, track({ hazards: ['water'], shareable: false }), 2).ok).toBe(true);
    expect(checkParallel(track({ minAdults: 2 }), books, 2).ok).toBe(false);
  });

  it('busy-nearby means same room, watching, hands free, and no undivided-attention hazards', () => {
    expect(isBusyNearbyCompatible(books)).toBe(true);
    expect(isBusyNearbyCompatible(tummy)).toBe(false);
    expect(isBusyNearbyCompatible(track({ hazards: ['water'] }))).toBe(false);
    expect(isBusyNearbyCompatible(track({ participation: 'joins' }))).toBe(false);
  });
});
