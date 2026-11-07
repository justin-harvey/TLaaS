// src/lib/budget-health.ts — shared budget-health scoring used by the Budget
// Analytics surface and the Executive Overview, so both rate departments
// identically. Score combines run-rate pace, utilization, and anomaly flags.

export type HealthRating = 'Healthy' | 'Watch' | 'At Risk';
export interface HealthItem { name: string; rating: HealthRating; drivers: string[]; }

type BudgetMinimal = { name: string; budget: number; spent: number };

export const RATING_COLOR: Record<HealthRating, string> = {
  'Healthy': '#5F7E5A',
  'Watch':   '#B8862B',
  'At Risk': '#A8483A',
};
export const RATING_TONE: Record<HealthRating, 'anchored' | 'pending' | 'spike'> = {
  'Healthy': 'anchored',
  'Watch':   'pending',
  'At Risk': 'spike',
};

export function computeBudgetHealth(
  lines: BudgetMinimal[],
  fyElapsedPct: number,
  deptAnomalies: Record<string, number>,
): HealthItem[] {
  return lines.map(l => {
    const projectedPct = (fyElapsedPct > 0 ? l.spent / fyElapsedPct : l.spent) / l.budget;
    const util = l.spent / l.budget;
    const anomalies = deptAnomalies[l.name] ?? 0;
    const drivers: string[] = [];
    let pts = 0;
    if (projectedPct > 1.05) { pts += 2; drivers.push('Projected over'); }
    else if (projectedPct >= 0.95) { pts += 1; drivers.push('Near budget'); }
    if (util >= 1.0) { pts += 1; drivers.push('At / over spent'); }
    if (anomalies > 0) { pts += Math.min(anomalies, 2); drivers.push(`${anomalies} flag${anomalies > 1 ? 's' : ''}`); }
    const rating: HealthRating = pts >= 3 ? 'At Risk' : pts >= 1 ? 'Watch' : 'Healthy';
    return { name: l.name, rating, drivers };
  });
}

export function overallRating(items: HealthItem[]): { rating: HealthRating; counts: Record<HealthRating, number> } {
  const counts: Record<HealthRating, number> = { 'At Risk': 0, 'Watch': 0, 'Healthy': 0 };
  items.forEach(i => { counts[i.rating] += 1; });
  const rating: HealthRating = counts['At Risk'] ? 'At Risk' : counts['Watch'] ? 'Watch' : 'Healthy';
  return { rating, counts };
}

// Utilization -> status label/tone. Shared by the appropriation table, CSV export,
// and the council report so the thresholds never drift.
export function status(spent: number, budget: number): { tone: 'info' | 'pending' | 'spike'; label: string } {
  const pct = (spent / budget) * 100;
  if (pct >= 100) return { tone: 'spike',   label: 'At / Over' };
  if (pct >= 85)  return { tone: 'pending', label: 'Watch' };
  return { tone: 'info', label: 'On Track' };
}
