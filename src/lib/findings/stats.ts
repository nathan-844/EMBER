// Small, dependency-free statistics for the findings. Each is tested against hand-worked values.

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Ranks starting at 1; ties get the average of the ranks they span. */
export function ranks(xs: number[]): number[] {
  const order = xs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(xs.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[order[k][1]] = avg;
    i = j + 1;
  }
  return out;
}

/** Spearman rank correlation (Pearson correlation of the ranks, so ties are handled). Null if undefined. */
export function spearman(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 3) return null;
  const rx = ranks(x), ry = ranks(y);
  const mx = rx.reduce((a, b) => a + b, 0) / rx.length;
  const my = ry.reduce((a, b) => a + b, 0) / ry.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < rx.length; i++) {
    sxy += (rx[i] - mx) * (ry[i] - my);
    sxx += (rx[i] - mx) ** 2;
    syy += (ry[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

/** Round for display and for stable committed output. */
export const round = (v: number, digits = 2) => Number(v.toFixed(digits));

/** Seeded pseudo-random numbers (mulberry32), so bootstrap intervals are the same on every rebuild. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const BOOTSTRAP_RESAMPLES = 2000;
export const BOOTSTRAP_SEED = 20261115;

/** Value at quantile q (0–1) of sorted numbers, linear between neighbours. */
export function quantile(sorted: number[], q: number): number {
  const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/**
 * Percentile bootstrap: resample each group with replacement, recompute the statistic, and take the
 * 2.5th and 97.5th percentiles. Resamples where the statistic is undefined are skipped. Null when
 * fewer than half the resamples give a value.
 */
export function bootstrapCI<T>(groups: T[][], stat: (resampled: T[][]) => number | null, seed = BOOTSTRAP_SEED, resamples = BOOTSTRAP_RESAMPLES): [number, number] | null {
  const rand = seededRandom(seed);
  const out: number[] = [];
  for (let b = 0; b < resamples; b++) {
    const v = stat(groups.map((g) => g.map(() => g[Math.floor(rand() * g.length)])));
    if (v !== null && Number.isFinite(v)) out.push(v);
  }
  if (out.length < resamples / 2) return null;
  out.sort((a, b) => a - b);
  return [quantile(out, 0.025), quantile(out, 0.975)];
}

/** Wilson score 95% interval for k successes out of n. */
export function wilson(k: number, n: number, z = 1.959964): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n, z2 = z * z, d = 1 + z2 / n;
  const c = (p + z2 / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

/** Exact two-sided sign test: probability of a split at least this uneven if both directions were equally likely. Ties are dropped beforehand. */
export function signTestP(a: number, b: number): number {
  const n = a + b, k = Math.min(a, b);
  if (n === 0) return 1;
  let tail = 0, c = 1;
  for (let i = 0; i <= k; i++) { tail += c; c = (c * (n - i)) / (i + 1); }
  return Math.min(1, (2 * tail) / 2 ** n);
}

/** "0.12–0.34" style interval text. */
export const ciText = (ci: [number, number] | null, digits = 2) => (ci ? `${round(ci[0], digits)} to ${round(ci[1], digits)}` : "not estimable");
/** A proportion interval as whole percentages. */
export const pctCi = (ci: [number, number]) => `${Math.round(ci[0] * 100)}–${Math.round(ci[1] * 100)}%`;
