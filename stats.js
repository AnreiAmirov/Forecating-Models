/**
 * stats.js
 * Pure statistical functions — no DOM, no side effects.
 * Shared between index.html (browser) and stats.test.js (Node.js).
 *
 * Functions:
 *   normInvCDF(p)                   — inverse normal CDF
 *   normCDF(z)                      — normal CDF
 *   normPDF(x, mu, sigma)           — normal PDF
 *   mean(arr)                       — sample mean
 *   variance(arr)                   — sample variance (n-1)
 */

function normInvCDF(p) {
  const a = [0,-3.969683028665376e+01,2.209460984245205e+02,-2.759285104469687e+02,1.383577518672690e+02,-3.066479806614716e+01,2.506628277459239e+00];
  const b = [0,-5.447609879822406e+01,1.615858368580409e+02,-1.556989798598866e+02,6.680131188771972e+01,-1.328068155288572e+01];
  const c = [0,-7.784894002430293e-03,-3.223964580411365e-01,-2.400758277161838e+00,-2.549732539343734e+00,4.374664141464968e+00,2.938163982698783e+00];
  const d = [0,7.784695709041462e-03,3.224671290700398e-01,2.445134137142996e+00,3.754408661907416e+00];
  const pLow=0.02425, pHigh=1-pLow; let q,r;
  if(p<pLow){q=Math.sqrt(-2*Math.log(p));return(((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6])/((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1);}
  else if(p<=pHigh){q=p-0.5;r=q*q;return(((((a[1]*r+a[2])*r+a[3])*r+a[4])*r+a[5])*r+a[6])*q/(((((b[1]*r+b[2])*r+b[3])*r+b[4])*r+b[5])*r+1);}
  else{q=Math.sqrt(-2*Math.log(1-p));return-(((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6])/((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1);}
}
function normCDF(z){const t=1/(1+0.2316419*Math.abs(z));const p=1-(1/Math.sqrt(2*Math.PI))*Math.exp(-0.5*z*z)*(0.319381530*t-0.356563782*t**2+1.781477937*t**3-1.821255978*t**4+1.330274429*t**5);return z>=0?p:1-p;}
function mean(arr){return arr.reduce((s,v)=>s+v,0)/arr.length;}
function variance(arr){const m=mean(arr);return arr.reduce((s,v)=>s+(v-m)**2,0)/(arr.length-1);}

function normPDF(x, mu, sigma) {
  return Math.exp(-0.5*((x-mu)/sigma)**2) / (sigma * Math.sqrt(2*Math.PI));
}

// ───────────────────────────────────────────────────────────────────────────
// Higher-level test functions. These mirror EXACTLY the formulas used in the
// app's Analyse tab, so testing them here guarantees the live results are sound.
// All are pure (no DOM, no side effects).
// ───────────────────────────────────────────────────────────────────────────

/**
 * Two-proportion Z-test (unpooled standard error), as used for 2-group conversion.
 * @param {{n:number,c:number}} A  control: n exposed, c converted
 * @param {{n:number,c:number}} B  variant
 * @param {number} tails  1 or 2
 * @returns {{pA,pB,se,z,p,liftPct}}
 */
function twoPropZTest(A, B, tails = 2) {
  const pA = A.c / A.n, pB = B.c / B.n;
  const se = Math.sqrt(pA*(1-pA)/A.n + pB*(1-pB)/B.n);
  const z = (pB - pA) / se;
  const p = tails === 2 ? 2*(1-normCDF(Math.abs(z))) : 1-normCDF(z);
  return { pA, pB, se, z, p, liftPct: (pB-pA)/pA*100 };
}

/**
 * Chi-squared statistic for a k-variant conversion table, with the
 * Wilson–Hilferty normal approximation for the p-value (matches the app).
 * @param {Array<{n:number,c:number}>} variants
 * @returns {{chi2,df,p}}
 */
function chiSquaredConversion(variants) {
  const total = variants.reduce((s,v)=>s+v.n, 0);
  const totalConv = variants.reduce((s,v)=>s+v.c, 0);
  const pPool = totalConv / total;
  let chi2 = 0;
  for (const v of variants) {
    const exp = v.n * pPool;
    chi2 += (v.c-exp)**2/exp + ((v.n-v.c)-v.n*(1-pPool))**2/(v.n*(1-pPool));
  }
  const df = variants.length - 1;
  const zChi = ((Math.cbrt(chi2/df)) - (1 - 2/(9*df))) / Math.sqrt(2/(9*df));
  const p = 1 - normCDF(zChi);
  return { chi2, df, p };
}

/**
 * Holm–Bonferroni step-down across (k-1) variant-vs-control comparisons.
 * @param {Array<{n:number,c:number}>} variants  index 0 = control
 * @param {number} alpha
 * @returns {{ comparisons: Array<{i,p,thr,significant,lift}>, bestIdx }}
 */
function holmBonferroni(variants, alpha = 0.05) {
  const A = { ...variants[0], p: variants[0].c/variants[0].n };
  const k = variants.length - 1;
  const comps = [];
  for (let i = 1; i < variants.length; i++) {
    const v = { ...variants[i], p: variants[i].c/variants[i].n };
    const seAB = Math.sqrt(A.p*(1-A.p)/A.n + v.p*(1-v.p)/v.n);
    const zAB = (v.p - A.p) / seAB;
    const pvAB = 2*(1-normCDF(Math.abs(zAB)));
    comps.push({ i, p: pvAB, lift: (v.p-A.p)/A.p*100 });
  }
  const ordered = comps.slice().sort((a,b)=>a.p-b.p);
  let stillRejecting = true;
  ordered.forEach((c, rank) => {
    const thr = alpha / (k - rank);
    c.thr = thr;
    c.significant = stillRejecting && c.p < thr;
    if (!c.significant) stillRejecting = false;
  });
  // best variant: highest rate among significant positive-lift winners
  let bestIdx = -1, bestRate = -Infinity;
  comps.forEach(c => {
    const rate = variants[c.i].c/variants[c.i].n;
    if (c.significant && c.lift > 0 && rate > bestRate) { bestRate = rate; bestIdx = c.i; }
  });
  return { comparisons: comps, bestIdx };
}

/**
 * Welch's t-test (unequal variances), with normal approximation for the p-value
 * and Welch–Satterthwaite degrees of freedom — matches the app's runWelchT.
 * @param {{n,mean,sd}} A
 * @param {{n,mean,sd}} B
 * @param {number} tails
 * @returns {{se,t,df,p,liftPct}}
 */
function welchT(A, B, tails = 2) {
  const se = Math.sqrt(A.sd**2/A.n + B.sd**2/B.n);
  const t = (B.mean - A.mean) / se;
  const df = (A.sd**2/A.n + B.sd**2/B.n)**2 /
             ((A.sd**2/A.n)**2/(A.n-1) + (B.sd**2/B.n)**2/(B.n-1));
  const p = tails === 2 ? 2*(1-normCDF(Math.abs(t))) : 1-normCDF(t);
  return { se, t, df, p, liftPct: (B.mean-A.mean)/A.mean*100 };
}

// Export for Node.js test runner (no effect in browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normInvCDF, normCDF, normPDF, mean, variance,
    twoPropZTest, chiSquaredConversion, holmBonferroni, welchT
  };
}
