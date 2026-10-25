/**
 * Recursive least squares with forgetting, the token meter's learner. It fits `real ≈ w · x` one sample at a time, in constant memory, where `x` is a few
 * base counts and a 1 for the intercept.
 *
 * It is written in its Kalman form, so every quantity carries real units:
 * - the covariance `p` is the uncertainty of the weights, in weight units;
 * - each sample carries its own noise variance, in tokens squared, set by the caller from how far
 *   this model's reports typically wander.
 *
 * Because the noise is real, one reply cannot pin a model. The prior (the family's weights and their
 * variances) keeps its pull until enough replies outweigh it: that is the spec's shrinkage toward the
 * prior, with no separate blend. Forgetting (λ < 1) inflates the covariance before each step, so old
 * evidence fades and a provider that changes its tokenizer is re-learned. A variance cap keeps a
 * direction with no new evidence from growing without bound. After every step the covariance is
 * checked to be a valid one; if rounding breaks that, it is reset to its capped diagonal.
 *
 * Pure numbers; no I/O.
 */

export interface Fit {
  /** The weights, one per feature. */
  w: number[];
  /** The weights' covariance, row-major, k × k. */
  p: number[];
  /** Samples learned from. */
  n: number;
}

/** A fit at its prior: the given weights, and a diagonal covariance of the given variances. */
export function priorFit(weights: readonly number[], variances: readonly number[]): Fit {
  const k = weights.length;
  const p = new Array<number>(k * k).fill(0);
  for (let i = 0; i < k; i++) p[i * k + i] = variances[i] ?? 0;
  return { w: [...weights], p, n: 0 };
}

export const predict = (fit: Fit, x: readonly number[]): number => fit.w.reduce((s, wi, i) => s + wi * (x[i] ?? 0), 0);

/** How uncertain the fit's prediction for `x` is, from the weights alone: xᵀ P x, in tokens squared. */
export function predictionVariance(fit: Fit, x: readonly number[]): number {
  const k = fit.w.length;
  let v = 0;
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) v += (x[i] ?? 0) * (fit.p[i * k + j] ?? 0) * (x[j] ?? 0);
  return Math.max(0, v);
}

/**
 * One step. `x` is the feature vector (zeros for features this sample says nothing about: a
 * prompt-to-prompt change carries no intercept), `y` the reported count, `noise` the sample's noise
 * variance in tokens squared, `lambda` the forgetting factor (1 for none), and `cap` the largest
 * variance any weight may reach. Returns the error before the update.
 */
export function update(fit: Fit, x: readonly number[], y: number, noise: number, lambda: number, cap: readonly number[]): number {
  const k = fit.w.length;
  for (let i = 0; i < k * k; i++) fit.p[i] = (fit.p[i] ?? 0) / lambda;
  const px = new Array<number>(k).fill(0);
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) px[i] = (px[i] ?? 0) + (fit.p[i * k + j] ?? 0) * (x[j] ?? 0);
  let s = Math.max(noise, 1e-9);
  for (let i = 0; i < k; i++) s += (x[i] ?? 0) * (px[i] ?? 0);
  const error = y - predict(fit, x);
  if (!Number.isFinite(s)) return error;
  for (let i = 0; i < k; i++) fit.w[i] = (fit.w[i] ?? 0) + ((px[i] ?? 0) / s) * error;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) fit.p[i * k + j] = (fit.p[i * k + j] ?? 0) - ((px[i] ?? 0) * (px[j] ?? 0)) / s;
  }
  settle(fit, cap);
  fit.n += 1;
  return error;
}

/**
 * Keeps the covariance a valid, bounded one: symmetric, each variance within (0, cap], and positive
 * definite. A Cholesky attempt is the definiteness check; when it fails, the covariance falls back to
 * its capped diagonal, which forgets correlations but never claims certainty it does not have.
 */
function settle(fit: Fit, cap: readonly number[]): void {
  const k = fit.w.length;
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const v = ((fit.p[i * k + j] ?? 0) + (fit.p[j * k + i] ?? 0)) / 2;
      fit.p[i * k + j] = v;
      fit.p[j * k + i] = v;
    }
    const d = fit.p[i * k + i] ?? 0;
    fit.p[i * k + i] = Math.min(Math.max(d, 1e-12), cap[i] ?? d);
  }
  if (!positiveDefinite(fit.p, k)) {
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) if (i !== j) fit.p[i * k + j] = 0;
  }
}

export function positiveDefinite(p: readonly number[], k: number): boolean {
  const l = new Array<number>(k * k).fill(0);
  for (let i = 0; i < k; i++) {
    for (let j = 0; j <= i; j++) {
      let s = p[i * k + j] ?? 0;
      for (let m = 0; m < j; m++) s -= (l[i * k + m] ?? 0) * (l[j * k + m] ?? 0);
      if (i === j) {
        if (!(s > 0)) return false;
        l[i * k + i] = Math.sqrt(s);
      } else l[i * k + j] = s / (l[j * k + j] ?? 1);
    }
  }
  return true;
}

/** Loosens a fit so it re-learns quickly (a detected tokenizer change): variances grow to the cap. */
export function loosen(fit: Fit, cap: readonly number[]): void {
  const k = fit.w.length;
  for (let i = 0; i < k; i++) fit.p[i * k + i] = cap[i] ?? fit.p[i * k + i] ?? 0;
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) if (i !== j) fit.p[i * k + j] = 0;
}

/** A fit is usable only if every number in it is finite. A corrupt stored fit is refused, not trusted. */
export const isFiniteFit = (fit: Fit): boolean => [...fit.w, ...fit.p, fit.n].every((v) => Number.isFinite(v));
