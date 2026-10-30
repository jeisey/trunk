/**
 * Runtime access to the bundled, build-validated catalog.
 *
 * Activities, recipes, and starter plans ship with the app. Claims and sources
 * (the evidence behind them) load lazily via loadEvidence(), so the first screen
 * stays fast; the app prefetches them when idle.
 */
import { useEffect, useState } from 'react';
import data from '../generated/catalog.json';
import type { Activity, Claim, MixedAgeRecipe, Source, StarterPlan, TimingRule } from './schema.ts';
import type { Catalog } from './validate.ts';

export interface IndexedCatalog extends Catalog {
  activityById: Map<string, Activity>;
  recipeById: Map<string, MixedAgeRecipe>;
  claimById: Map<string, Claim>;
  sourceById: Map<string, Source>;
  planById: Map<string, StarterPlan>;
  timingRuleById: Map<string, TimingRule>;
}

export function indexCatalog(c: Catalog): IndexedCatalog {
  return {
    ...c,
    activityById: new Map(c.activities.map((a) => [a.id, a])),
    recipeById: new Map(c.recipes.map((r) => [r.id, r])),
    claimById: new Map(c.claims.map((x) => [x.id, x])),
    sourceById: new Map(c.sources.map((s) => [s.id, s])),
    planById: new Map(c.starterPlans.map((p) => [p.id, p])),
    timingRuleById: new Map(c.timingRules.map((t) => [t.id, t])),
  };
}

const bundled = data as unknown as Omit<Catalog, 'claims' | 'sources'> & { version: string; sourceCount: number };

/** Latest source-check date across the catalog. */
export const contentVersion: string = bundled.version;
export const sourceCount: number = bundled.sourceCount;

export const catalog: IndexedCatalog = indexCatalog({ ...bundled, claims: [], sources: [] });

let evidence: Promise<void> | null = null;
let evidenceReady = false;

/** Load claims and sources into the catalog once. Safe to call repeatedly. */
export function loadEvidence(c: IndexedCatalog = catalog): Promise<void> {
  if (c !== catalog || evidenceReady) return Promise.resolve();
  evidence ??= import('../generated/evidence.json').then((m) => {
    const e = m.default as unknown as { claims: Claim[]; sources: Source[] };
    c.claims.push(...e.claims);
    c.sources.push(...e.sources);
    e.claims.forEach((x) => c.claimById.set(x.id, x));
    e.sources.forEach((x) => c.sourceById.set(x.id, x));
    evidenceReady = true;
  });
  return evidence;
}

/** True once evidence is available; triggers loading on first use. */
export function useEvidence(c: IndexedCatalog = catalog): boolean {
  const [ready, setReady] = useState(c !== catalog || evidenceReady);
  useEffect(() => {
    if (ready) return;
    let live = true;
    loadEvidence(c).then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [c, ready]);
  return ready;
}

/** Claims cited anywhere on an activity, de-duplicated, in display order. */
export function activityClaims(c: IndexedCatalog, a: Activity): Claim[] {
  const ids = [...a.evidence.claims, ...(a.why?.claims ?? []), ...a.safety.flatMap((s) => s.claims)];
  return [...new Set(ids)].map((id) => c.claimById.get(id)).filter((x): x is Claim => Boolean(x));
}

export function recipeClaims(c: IndexedCatalog, r: MixedAgeRecipe): Claim[] {
  const ids = [...r.claims, ...r.safety.flatMap((s) => s.claims)];
  return [...new Set(ids)].map((id) => c.claimById.get(id)).filter((x): x is Claim => Boolean(x));
}
