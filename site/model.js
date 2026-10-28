/*
 * Voter power model. Pure functions, no DOM. Works in the browser (window.VPI)
 * and in Node (module.exports) so the same code can be tested.
 *
 * Symbols
 *   mu     expected Democratic-minus-Republican margin, as a fraction of total votes (+ = Democrat ahead)
 *   p      forecaster's probability that the Democrat wins
 *   sigma  spread (standard deviation / scale) of the final margin
 *   z      mu / sigma
 *   T      total votes cast in the 2024 presidential election (turnout proxy)
 *   f      density of the margin curve (Normal or Student t) evaluated at z
 *   P      probability that one ballot decides the race
 *   w      Senate weight in the combined index
 */
(function (root) {
  "use strict";

  // ---------- special functions ----------
  function normPdf(x) { return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI); }

  // Inverse normal CDF (Acklam's algorithm, relative error ~1e-9).
  function normInv(p) {
    var a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    var b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    var c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    var d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    var plow = 0.02425, phigh = 1 - plow, q, r, x;
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    if (p < plow) {
      q = Math.sqrt(-2 * Math.log(p));
      x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= phigh) {
      q = p - 0.5; r = q * q;
      x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    return x;
  }
  function erfc(x) { // W. J. Cody-style rational approximation through complementary error function
    var z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    var r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  function normCdf(x) { return 0.5 * erfc(-x / Math.SQRT2); }

  function lgamma(x) {
    var g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    x -= 1;
    var a = c[0], t = x + g + 0.5;
    for (var i = 1; i < g + 2; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }

  // Student t density
  function tPdf(x, nu) {
    return Math.exp(lgamma((nu + 1) / 2) - lgamma(nu / 2)) / Math.sqrt(nu * Math.PI) * Math.pow(1 + x * x / nu, -(nu + 1) / 2);
  }
  // regularized incomplete beta (Numerical Recipes continued fraction)
  function betacf(a, b, x) {
    var MAXIT = 300, EPS = 3e-14, FPMIN = 1e-300, qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap, h, aa, del, m, m2;
    if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; h = d;
    for (m = 1; m <= MAXIT; m++) {
      m2 = 2 * m;
      aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; del = d * c; h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  function betai(a, b, x) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    var bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
    return 1 - bt * betacf(b, a, 1 - x) / b;
  }
  function tCdf(x, nu) {
    var ib = betai(nu / 2, 0.5, nu / (nu + x * x));
    return x >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
  }
  // inverse t CDF by bisection (p in (0,1))
  function tInv(p, nu) {
    if (p === 0.5) return 0;
    var lo = -1e3, hi = 1e3, mid, i;
    for (i = 0; i < 200; i++) {
      mid = (lo + hi) / 2;
      if (tCdf(mid, nu) < p) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  function median(a) {
    var s = a.slice().sort(function (x, y) { return x - y; }), n = s.length;
    if (!n) return NaN;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }

  var MIN_ABS = 0.10, MAX_ABS = 0.45; // validity band for implied sigma: |p - 0.5|

  // implied sigma for one race, or null if not valid
  function impliedSigma(mu, p, shape, nu) {
    var d = Math.abs(p - 0.5);
    if (!(d >= MIN_ABS - 1e-9 && d <= MAX_ABS + 1e-9)) return null; // tolerance: 0.6 - 0.5 is 0.0999999... in floating point
    if (!(mu * (p - 0.5) > 0)) return null;
    var q = shape === "fat" ? tInv(p, nu) : normInv(p);
    var s = mu / q;
    return isFinite(s) && s > 0 ? s : null;
  }

  function density(z, shape, nu) { return shape === "fat" ? tPdf(z, nu) : normPdf(z); }

  /*
   * settings: { weighting: "weighted"|"unweighted", w: number, sigma: "common"|"implied", shape: "normal"|"fat", nu: number }
   * data: { house: [{id,state,mu,p,T}], senate: [{id,state,mu,p,T}] }
   */
  function compute(settings, data) {
    var shape = settings.shape, nu = settings.nu || 4, weighted = settings.weighting === "weighted", w = settings.w;
    var H = data.house, S = data.senate;

    var hImpl = H.map(function (r) { return impliedSigma(r.mu, r.p, shape, nu); });
    var sImpl = S.map(function (r) { return impliedSigma(r.mu, r.p, shape, nu); });
    var hMed = median(hImpl.filter(function (x) { return x !== null; }));
    var sMed = median(sImpl.filter(function (x) { return x !== null; }));
    var common = settings.sigma === "common";

    function power(r, impl, med) {
      var sig = (common || impl === null) ? med : impl;
      var z = r.mu / sig;
      var P = 2 * density(z, shape, nu) / sig;
      if (weighted) P /= r.T;
      return { sigma: sig, z: z, P: P };
    }

    var hRows = H.map(function (r, i) { var o = power(r, hImpl[i], hMed); o.rec = r; return o; });
    var sRows = S.map(function (r, i) { var o = power(r, sImpl[i], sMed); o.rec = r; return o; });

    var stateSen = {};
    sRows.forEach(function (o) { stateSen[o.rec.state] = (stateSen[o.rec.state] || 0) + o.P; });

    var sumT = 0, sumTH = 0, sumTT = 0, sumSen = 0, i;
    hRows.forEach(function (o) {
      o.Ps = stateSen[o.rec.state] || 0;
      o.Pt = o.P + w * o.Ps;
      sumT += o.rec.T;
    });
    var meanH, meanT, meanS;
    if (weighted) {
      hRows.forEach(function (o) { sumTH += o.rec.T * o.P; sumTT += o.rec.T * o.Pt; });
      sRows.forEach(function (o) { sumSen += o.P * o.rec.T; });
      meanH = sumTH / sumT; meanT = sumTT / sumT; meanS = sumSen / sumT;
    } else {
      var a = 0, b = 0, c = 0;
      hRows.forEach(function (o) { a += o.P; b += o.Pt; });
      sRows.forEach(function (o) { c += o.P; });
      meanH = a / hRows.length; meanT = b / hRows.length; meanS = c / sRows.length;
    }
    hRows.forEach(function (o) { o.indexHouse = o.P / meanH; o.indexTotal = o.Pt / meanT; });
    sRows.forEach(function (o) { o.indexSenate = o.P / meanS; });

    return { house: hRows, senate: sRows, sigmaHouse: hMed, sigmaSenate: sMed, means: { house: meanH, total: meanT, senate: meanS } };
  }

  // rank (1 = highest) of every row by a key; ties share the same rank
  function ranks(rows, key) {
    var idx = rows.map(function (_, i) { return i; }).sort(function (a, b) { return rows[b][key] - rows[a][key]; });
    var r = new Array(rows.length), pos = 1;
    for (var k = 0; k < idx.length; k++) {
      if (k > 0 && rows[idx[k]][key] === rows[idx[k - 1]][key]) r[idx[k]] = r[idx[k - 1]];
      else r[idx[k]] = pos;
      pos++;
    }
    return r;
  }

  root.VPI = { compute: compute, ranks: ranks, impliedSigma: impliedSigma, normInv: normInv, normPdf: normPdf, normCdf: normCdf, tPdf: tPdf, tCdf: tCdf, tInv: tInv, median: median };
  if (typeof module !== "undefined" && module.exports) module.exports = root.VPI;
})(typeof window !== "undefined" ? window : globalThis);
