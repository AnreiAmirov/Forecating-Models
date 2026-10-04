// ── Charts ──────────────────────────────────────────

function drawCharts() {
  // Theme-aware colours — read from RC at draw time
  const P    = RC.P;
  const PL   = RC.PL;
  const OR   = RC.OR;
  const ORL  = RC.ORL;
  const RED  = RC.REDL || 'rgba(220,50,50,0.25)';
  const GREY = 'rgba(120,120,140,0.2)';
  const INK   = () => RC.INK;
  const MUTED = () => RC.MUTED;
  const dpr = window.devicePixelRatio || 1;

  function initCanvas(id) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    const wrap = canvas.parentElement;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    // Modern rendering defaults: smooth joins/caps for all strokes
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    return { ctx, W, H };
  }

  // Vertical gradient from a solid colour (top) fading to transparent (bottom)
  function vGrad(ctx, hex, topY, botY, topAlpha, botAlpha) {
    const g = ctx.createLinearGradient(0, topY, 0, botY);
    const rgb = hexToRgb(hex);
    g.addColorStop(0, `rgba(${rgb},${topAlpha != null ? topAlpha : 0.32})`);
    g.addColorStop(1, `rgba(${rgb},${botAlpha != null ? botAlpha : 0.02})`);
    return g;
  }
  function hexToRgb(hex) {
    const h = hex.replace('#','');
    const n = parseInt(h.length === 3 ? h.split('').map(c=>c+c).join('') : h, 16);
    return `${(n>>16)&255},${(n>>8)&255},${n&255}`;
  }

  function labelStyle(ctx) {
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.fillStyle = MUTED();
  }

  // ── Chart 1: Significance ──
  (function() {
    const c = initCanvas('chart-significance'); if (!c) return;
    const { ctx, W, H } = c;
    const pad = { t: 20, b: 32, l: 16, r: 16 };
    const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
    const zCrit = 1.96;
    const xMin = -4, xMax = 4;
    const yMax = normPDF(0, 0, 1) * 1.15;
    function toX(z) { return pad.l + (z - xMin) / (xMax - xMin) * cw; }
    function toY(y) { return pad.t + ch - (y / yMax) * ch; }

    // rejection fills
    [[xMin, -zCrit], [zCrit, xMax]].forEach(([from, to]) => {
      ctx.beginPath();
      ctx.moveTo(toX(from), toY(0));
      for (let z = from; z <= to; z += 0.05) ctx.lineTo(toX(z), toY(normPDF(z, 0, 1)));
      ctx.lineTo(toX(to), toY(0)); ctx.closePath();
      ctx.fillStyle = RED; ctx.fill();
    });

    // main fill
    ctx.beginPath();
    ctx.moveTo(toX(xMin), toY(0));
    for (let z = xMin; z <= xMax; z += 0.05) ctx.lineTo(toX(z), toY(normPDF(z, 0, 1)));
    ctx.lineTo(toX(xMax), toY(0)); ctx.closePath();
    ctx.fillStyle = PL; ctx.fill();

    // curve
    ctx.beginPath();
    for (let z = xMin; z <= xMax; z += 0.05)
      z === xMin ? ctx.moveTo(toX(z), toY(normPDF(z,0,1))) : ctx.lineTo(toX(z), toY(normPDF(z,0,1)));
    ctx.strokeStyle = P; ctx.lineWidth = 2; ctx.stroke();

    // critical lines
    [zCrit, -zCrit].forEach(z => {
      ctx.beginPath(); ctx.setLineDash([4, 4]);
      ctx.moveTo(toX(z), toY(0)); ctx.lineTo(toX(z), toY(normPDF(z, 0, 1)));
      ctx.strokeStyle = MUTED(); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.setLineDash([]);
    });

    // baseline
    ctx.beginPath();
    ctx.moveTo(pad.l, toY(0)); ctx.lineTo(W - pad.r, toY(0));
    ctx.strokeStyle = MUTED(); ctx.lineWidth = 1; ctx.stroke();

    // labels
    labelStyle(ctx); ctx.textAlign = 'center';
    ctx.fillText('−z₀.₀₅ = −1.96', toX(-zCrit), H - 10);
    ctx.fillText('+1.96', toX(zCrit), H - 10);
    ctx.fillText('0', toX(0), H - 10);
    ctx.fillStyle = OR;
    ctx.fillText(T[currentLang].chart_reject||'reject H₀', toX(-3.2), pad.t + 14);
    ctx.fillText(T[currentLang].chart_reject||'reject H₀', toX(3.2), pad.t + 14);
    ctx.fillStyle = P;
    ctx.fillText(T[currentLang].chart_fail_reject||'fail to reject H₀', toX(0), pad.t + 14);
  })();

  // ── Chart 2: Type I & II errors ──
  (function() {
    const c = initCanvas('chart-errors'); if (!c) return;
    const { ctx, W, H } = c;
    const pad = { t: 24, b: 32, l: 16, r: 16 };
    const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
    const mu0 = 0, mu1 = 2.5, sig = 1;
    const zCrit = 1.645;
    const critX = mu0 + zCrit * sig;
    const xMin = -3.5, xMax = 6;
    const yMax = normPDF(0, 0, sig) * 1.2;
    function toX(x) { return pad.l + (x - xMin) / (xMax - xMin) * cw; }
    function toY(y) { return pad.t + ch - (y / yMax) * ch; }

    // β region (missed — grey)
    ctx.beginPath();
    ctx.moveTo(toX(xMin > mu1 - 3*sig ? xMin : mu1 - 3*sig), toY(0));
    for (let x = mu1 - 3*sig; x <= critX; x += 0.05)
      ctx.lineTo(toX(x), toY(normPDF(x, mu1, sig)));
    ctx.lineTo(toX(critX), toY(0)); ctx.closePath();
    ctx.fillStyle = GREY; ctx.fill();

    // α region (false positive — red)
    ctx.beginPath();
    ctx.moveTo(toX(critX), toY(0));
    for (let x = critX; x <= xMax; x += 0.05)
      ctx.lineTo(toX(x), toY(normPDF(x, mu0, sig)));
    ctx.lineTo(toX(xMax), toY(0)); ctx.closePath();
    ctx.fillStyle = RED; ctx.fill();

    // H0 fill
    ctx.beginPath();
    for (let x = xMin; x <= xMax; x += 0.05)
      x === xMin ? ctx.moveTo(toX(x), toY(normPDF(x,mu0,sig))) : ctx.lineTo(toX(x), toY(normPDF(x,mu0,sig)));
    ctx.lineTo(toX(xMax), toY(0)); ctx.lineTo(toX(xMin), toY(0)); ctx.closePath();
    ctx.fillStyle = PL; ctx.fill();

    // H1 fill
    ctx.beginPath();
    for (let x = xMin; x <= xMax; x += 0.05)
      x === xMin ? ctx.moveTo(toX(x), toY(normPDF(x,mu1,sig))) : ctx.lineTo(toX(x), toY(normPDF(x,mu1,sig)));
    ctx.lineTo(toX(xMax), toY(0)); ctx.lineTo(toX(xMin), toY(0)); ctx.closePath();
    ctx.fillStyle = ORL; ctx.fill();

    // curves
    [{ mu: mu0, col: P }, { mu: mu1, col: OR }].forEach(({ mu, col }) => {
      ctx.beginPath();
      for (let x = xMin; x <= xMax; x += 0.05)
        x === xMin ? ctx.moveTo(toX(x), toY(normPDF(x,mu,sig))) : ctx.lineTo(toX(x), toY(normPDF(x,mu,sig)));
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
    });

    // critical line
    ctx.beginPath(); ctx.setLineDash([4, 4]);
    ctx.moveTo(toX(critX), toY(0)); ctx.lineTo(toX(critX), toY(normPDF(critX, mu0, sig)));
    ctx.strokeStyle = MUTED(); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.setLineDash([]);

    // baseline
    ctx.beginPath();
    ctx.moveTo(pad.l, toY(0)); ctx.lineTo(W - pad.r, toY(0));
    ctx.strokeStyle = MUTED(); ctx.lineWidth = 1; ctx.stroke();

    // labels
    labelStyle(ctx); ctx.textAlign = 'center';
    ctx.fillStyle = P;    ctx.fillText(T[currentLang].chart_h0_null||'H₀ (null)',  toX(mu0), pad.t + 12);
    ctx.fillStyle = OR;   ctx.fillText(T[currentLang].chart_h1_effect||'H₁ (true effect)', toX(mu1), pad.t + 12);
    ctx.fillStyle = 'rgba(200,50,50,0.8)'; ctx.fillText('α', toX(critX + 0.55), toY(0.04));
    ctx.fillStyle = MUTED(); ctx.fillText('β', toX(critX - 0.6), toY(0.06));
  })();

  // ── Chart 3: Sample size vs MDE ──
  (function() {
    const c = initCanvas('chart-samplesize'); if (!c) return;
    const { ctx, W, H } = c;
    const pad = { t: 16, b: 46, l: 52, r: 16 };
    const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
    const mdes = [], ns = [];
    for (let mde = 0.01; mde <= 0.30; mde += 0.005) {
      const p = 0.05, p2 = p*(1+mde);
      const pb = (p+p2)/2;
      const z_a = 1.96, z_b = 0.842;
      const n = Math.ceil((z_a*Math.sqrt(2*pb*(1-pb)) + z_b*Math.sqrt(p*(1-p)+p2*(1-p2)))**2 / (p2-p)**2);
      mdes.push(mde*100); ns.push(Math.min(n, 200000));
    }
    const xMin = mdes[0], xMax = mdes[mdes.length-1];
    const yMin = 0, yMax = Math.max(...ns) * 1.05;
    function toX(v) { return pad.l + (v - xMin) / (xMax - xMin) * cw; }
    function toY(v) { return pad.t + ch - ((v - yMin) / (yMax - yMin)) * ch; }

    // gridlines
    [0.25, 0.5, 0.75, 1].forEach(f => {
      const y = toY(yMax * f);
      ctx.beginPath(); ctx.setLineDash([2, 4]);
      ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y);
      ctx.strokeStyle = RC.BORDER; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.setLineDash([]);
      labelStyle(ctx); ctx.textAlign = 'right';
      const val = yMax * f;
      ctx.fillText(val >= 1000 ? (val/1000).toFixed(0)+'k' : val.toFixed(0), pad.l - 4, y + 4);
    });

    // curve fill
    ctx.beginPath();
    mdes.forEach((x, i) => i === 0 ? ctx.moveTo(toX(x), toY(ns[i])) : ctx.lineTo(toX(x), toY(ns[i])));
    ctx.lineTo(toX(xMax), toY(0)); ctx.lineTo(toX(xMin), toY(0)); ctx.closePath();
    ctx.fillStyle = PL; ctx.fill();

    // curve line
    ctx.beginPath();
    mdes.forEach((x, i) => i === 0 ? ctx.moveTo(toX(x), toY(ns[i])) : ctx.lineTo(toX(x), toY(ns[i])));
    ctx.strokeStyle = P; ctx.lineWidth = 2; ctx.stroke();

    // x axis labels (MDE %)
    labelStyle(ctx); ctx.textAlign = 'center';
    [5, 10, 15, 20, 25, 30].forEach(v => {
      ctx.fillText(v + '%', toX(v), H - 16);
    });
    ctx.fillStyle = RC.MUTED; ctx.font = '600 10px Inter, sans-serif';
    ctx.fillText(T[currentLang].chart_mde_axis || 'Minimum Detectable Effect (relative %)', pad.l + cw/2, H - 3);
  })();

  // ── Chart 4: Power curve ──
  (function() {
    const c = initCanvas('chart-power'); if (!c) return;
    const { ctx, W, H } = c;
    const pad = { t: 16, b: 36, l: 44, r: 16 };
    const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
    const p = 0.05, mde = 0.05, p2 = p*(1+mde);
    const pb = (p+p2)/2;
    const z_a = 1.96;
    const ns = [], powers = [];
    for (let n = 100; n <= 20000; n += 100) {
      const se = Math.sqrt(p*(1-p)/n + p2*(1-p2)/n);
      const z_beta = (Math.abs(p2-p)/se) - z_a;
      const power = Math.max(0, Math.min(1, 0.5 * (1 + Math.tanh(z_beta * 0.8))));
      ns.push(n); powers.push(power);
    }
    const xMin = ns[0], xMax = ns[ns.length-1];
    function toX(v) { return pad.l + (v - xMin) / (xMax - xMin) * cw; }
    function toY(v) { return pad.t + ch - v * ch; }

    // gridlines + y labels
    [0, 0.25, 0.5, 0.75, 0.8, 0.9, 1].forEach(f => {
      const y = toY(f);
      ctx.beginPath(); ctx.setLineDash([2, 4]);
      ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y);
      ctx.strokeStyle = RC.BORDER; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.setLineDash([]);
      labelStyle(ctx); ctx.textAlign = 'right';
      ctx.fillText((f * 100).toFixed(0) + '%', pad.l - 4, y + 4);
    });

    // threshold lines
    [0.8, 0.9].forEach(thresh => {
      ctx.beginPath(); ctx.setLineDash([6, 3]);
      ctx.moveTo(pad.l, toY(thresh)); ctx.lineTo(W - pad.r, toY(thresh));
      ctx.strokeStyle = thresh === 0.8 ? OR : P; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.setLineDash([]);
    });

    // fill
    ctx.beginPath();
    ns.forEach((x, i) => i === 0 ? ctx.moveTo(toX(x), toY(powers[i])) : ctx.lineTo(toX(x), toY(powers[i])));
    ctx.lineTo(toX(xMax), toY(0)); ctx.lineTo(toX(xMin), toY(0)); ctx.closePath();
    ctx.fillStyle = PL; ctx.fill();

    // curve
    ctx.beginPath();
    ns.forEach((x, i) => i === 0 ? ctx.moveTo(toX(x), toY(powers[i])) : ctx.lineTo(toX(x), toY(powers[i])));
    ctx.strokeStyle = P; ctx.lineWidth = 2; ctx.stroke();

    // x axis ticks
    labelStyle(ctx); ctx.textAlign = 'center';
    [2000, 5000, 10000, 15000, 20000].forEach(v => {
      ctx.fillText(v >= 1000 ? (v/1000)+'k' : v, toX(v), H - 6);
    });
  })();

  // ── Chart 5: CUPED variance reduction ──
  (function() {
    const c = initCanvas('chart-cuped'); if (!c) return;
    const { ctx, W, H } = c;
    const pad = { t: 46, b: 38, l: 16, r: 16 };  // extra top room for callout
    const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
    const reduction = (parseFloat(document.getElementById('cuped-slider')?.value) || 30) / 100;
    const baseN = 100;
    const cupedN = baseN * (1 - reduction);
    const bars = [
      { label: T[currentLang].cuped_bar_base || 'Without CUPED', val: baseN, col: RC.MUTED, fill: 'rgba(120,120,140,0.25)' },
      { label: T[currentLang].cuped_bar_cuped || 'With CUPED', val: cupedN, col: RC.GR, fill: RC.GRL },
    ];
    const yMax = baseN * 1.18;
    const barW = Math.min(90, cw / 2 * 0.5);
    const gap = (cw - barW * 2) / 3;
    function toY(v) { return pad.t + ch - (v / yMax) * ch; }

    // savings callout — centred at the very top, its own row
    if (reduction > 0) {
      ctx.fillStyle = RC.GR; ctx.font = '700 13px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('−' + Math.round(reduction*100) + '% ' + (T[currentLang].cuped_savings || 'fewer users'), pad.l + cw/2, 18);
    }

    // baseline axis
    ctx.beginPath(); ctx.moveTo(pad.l, toY(0)); ctx.lineTo(W - pad.r, toY(0));
    ctx.strokeStyle = RC.MUTED; ctx.lineWidth = 1; ctx.stroke();

    bars.forEach((b, i) => {
      const x = pad.l + gap + i * (barW + gap);
      const y = toY(b.val);
      ctx.fillStyle = b.fill;
      ctx.strokeStyle = b.col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x, y, barW, toY(0) - y, 8); ctx.fill(); ctx.stroke();
      // value label sits just above each bar (never near the callout)
      ctx.textAlign = 'center';
      ctx.fillStyle = RC.INK; ctx.font = '600 14px "JetBrains Mono", monospace';
      ctx.fillText(Math.round(b.val) + '%', x + barW/2, y - 10);
      // category label below axis
      ctx.fillStyle = RC.MUTED; ctx.font = '11px Inter, sans-serif';
      ctx.fillText(b.label, x + barW/2, H - 8);
    });
  })();

  // ── Chart 6: Peeking false-positive inflation ──
  (function() {
    const c = initCanvas('chart-peeking'); if (!c) return;
    const { ctx, W, H } = c;
    const pad = { t: 18, b: 46, l: 44, r: 16 };
    const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
    const maxPeeks = parseInt(document.getElementById('peek-slider')?.value) || 5;
    // Approximate inflated FP rate with k independent-ish looks: 1-(1-α)^effective
    // Use a damped model (looks are correlated): effective looks ≈ sqrt-ish growth
    function fpRate(k) {
      // empirically, daily peeking ~ alpha * (1 + ln(k)) capped; use a smooth approximation
      return Math.min(0.5, 1 - Math.pow(1 - 0.05, Math.sqrt(k) * 1.6));
    }
    const yMax = 0.5;
    function toX(k) { return pad.l + (k - 1) / (30 - 1) * cw; }
    function toY(v) { return pad.t + ch - (v / yMax) * ch; }
    // gridlines
    [0.05, 0.1, 0.2, 0.3, 0.4, 0.5].forEach(f => {
      const y = toY(f);
      ctx.beginPath(); ctx.setLineDash([2,4]);
      ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y);
      ctx.strokeStyle = f === 0.05 ? RC.GR : RC.BORDER;
      ctx.lineWidth = f === 0.05 ? 1.5 : 0.8; ctx.stroke(); ctx.setLineDash([]);
      labelStyle(ctx); ctx.textAlign = 'right';
      ctx.fillStyle = f === 0.05 ? RC.GR : RC.MUTED;
      ctx.fillText((f*100).toFixed(0) + '%', pad.l - 4, y + 4);
    });
    // curve fill
    ctx.beginPath();
    for (let k = 1; k <= 30; k++) (k === 1 ? ctx.moveTo(toX(k), toY(fpRate(k))) : ctx.lineTo(toX(k), toY(fpRate(k))));
    ctx.lineTo(toX(30), toY(0)); ctx.lineTo(toX(1), toY(0)); ctx.closePath();
    ctx.fillStyle = RC.REDL || 'rgba(220,50,50,0.15)'; ctx.fill();
    // curve
    ctx.beginPath();
    for (let k = 1; k <= 30; k++) (k === 1 ? ctx.moveTo(toX(k), toY(fpRate(k))) : ctx.lineTo(toX(k), toY(fpRate(k))));
    ctx.strokeStyle = RC.RED; ctx.lineWidth = 2; ctx.stroke();
    // marker at current slider value
    const fx = toX(maxPeeks), fy = toY(fpRate(maxPeeks));
    ctx.beginPath(); ctx.moveTo(fx, toY(0)); ctx.lineTo(fx, fy);
    ctx.strokeStyle = RC.INK; ctx.lineWidth = 1.5; ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(fx, fy, 5, 0, 2*Math.PI); ctx.fillStyle = RC.RED; ctx.fill();
    ctx.fillStyle = RC.INK; ctx.font = '600 12px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText((fpRate(maxPeeks)*100).toFixed(0) + '% ' + (T[currentLang].peek_actual || 'actual FP rate'), fx, fy - 12);
    // x axis
    labelStyle(ctx); ctx.textAlign = 'center'; ctx.fillStyle = RC.MUTED;
    [1, 10, 20, 30].forEach(k => ctx.fillText(k, toX(k), H - 16));
    ctx.fillStyle = RC.MUTED; ctx.font = '600 10px Inter, sans-serif';
    ctx.fillText(T[currentLang].peek_axis || 'Number of times you peek', pad.l + cw/2, H - 3);
  })();

  // ── Chart 7: Common distribution shapes (8 in a 4x2 grid) ──
  (function() {
    const c = initCanvas('chart-distshapes'); if (!c) return;
    const { ctx, W, H } = c;
    const cols = (W < 520) ? 2 : 4;
    const items = [
      { title: T[currentLang].dist_normal   || 'Normal',        kind:'curve', f: t => Math.exp(-Math.pow((t-0.5)/0.16,2)/2) },
      { title: T[currentLang].dist_skew     || 'Right-skewed',  kind:'curve', f: t => { const x=t*4; return (x*x*Math.exp(-x))/0.55; } },
      { title: T[currentLang].dist_leftskew || 'Left-skewed',   kind:'curve', f: t => { const x=(1-t)*4; return (x*x*Math.exp(-x))/0.55; } },
      { title: T[currentLang].dist_bimodal  || 'Bimodal',       kind:'curve', f: t => Math.exp(-Math.pow((t-0.30)/0.11,2)/2) + 0.85*Math.exp(-Math.pow((t-0.72)/0.11,2)/2) },
      { title: T[currentLang].dist_uniform  || 'Uniform',       kind:'bars',  bars:[1,1,1,1,1,1] },
      { title: T[currentLang].dist_triangular || 'Triangular (2 dice)', kind:'bars', bars:[1,2,3,4,5,6,5,4,3,2,1] },
      { title: T[currentLang].dist_exponential || 'Exponential',kind:'curve', f: t => Math.exp(-t*3.2) },
      { title: T[currentLang].dist_poisson  || 'Poisson (counts)', kind:'bars', bars:[2.2,4.2,5,3.8,2.2,1.0,0.4,0.15] },
    ];
    const rows = Math.ceil(items.length / cols);
    const cellW = W / cols, cellH = H / rows;
    items.forEach((item, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const ox = col * cellW, oy = row * cellH;
      const pad = { t: 24, b: 14, l: 12, r: 12 };
      const pw = cellW - pad.l - pad.r, ph = cellH - pad.t - pad.b;
      const bx = ox + pad.l, by = oy + pad.t;
      // baseline
      const drawBaseline = () => { ctx.beginPath(); ctx.moveTo(bx, by+ph); ctx.lineTo(bx+pw, by+ph); ctx.strokeStyle = RC.BORDER; ctx.lineWidth = 1; ctx.stroke(); };
      if (item.kind === 'curve') {
        const N = 80; const ys = []; let maxY = 0;
        for (let j=0; j<=N; j++){ const y = Math.max(0, item.f(j/N)); ys.push(y); if (y>maxY) maxY=y; }
        const toX = j => bx + (j/N)*pw;
        const toY = y => by + ph - (y/maxY)*ph*0.90;
        // gradient fill under the curve
        ctx.beginPath(); ctx.moveTo(toX(0), by+ph);
        ys.forEach((y,j) => ctx.lineTo(toX(j), toY(y)));
        ctx.lineTo(toX(N), by+ph); ctx.closePath();
        ctx.fillStyle = vGrad(ctx, RC.P, by, by+ph, 0.34, 0.03); ctx.fill();
        // smooth curve line
        ctx.beginPath();
        ys.forEach((y,j) => j===0 ? ctx.moveTo(toX(j), toY(y)) : ctx.lineTo(toX(j), toY(y)));
        ctx.strokeStyle = RC.P; ctx.lineWidth = 2.5; ctx.stroke();
        drawBaseline();
      } else {
        const bars = item.bars; const m = bars.length; const maxY = Math.max(...bars);
        const gap = pw / m * 0.16;
        const bw = (pw - gap*(m+1)) / m;
        const grad = vGrad(ctx, RC.P, by, by+ph, 0.55, 0.12);
        bars.forEach((v,j) => {
          const x = bx + gap + j*(bw+gap);
          const h = (v/maxY)*ph*0.90;
          const y = by + ph - h;
          ctx.fillStyle = grad; ctx.strokeStyle = RC.P; ctx.lineWidth = 1.4;
          const r = Math.min(3, bw/2);
          ctx.beginPath(); ctx.roundRect(x, y, bw, h, r); ctx.fill(); ctx.stroke();
        });
        drawBaseline();
      }
      // title
      ctx.fillStyle = RC.INK; ctx.font = '700 10.5px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(item.title, ox + cellW/2, oy + 15);
    });
  })();

  // ── Chart 8: Central Limit Theorem demo (interactive) ──
  (function() {
    const c = initCanvas('chart-clt'); if (!c) return;
    const { ctx, W, H } = c;
    const n = parseInt(document.getElementById('clt-slider')?.value) || 1;
    const pad = { t: 30, b: 40, l: 16, r: 16 };
    const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
    // Population is strongly right-skewed (exponential-like).
    // We show the distribution of the SAMPLE MEAN for sample size n.
    // Mean of exp(1) = 1; sampling dist of mean has mean 1, sd = 1/sqrt(n).
    // As n grows it becomes tight + normal-shaped (CLT).
    const popMean = 1;
    const binN = 70;
    const sd = 1 / Math.sqrt(n);
    // For n=1 show the skewed population itself; for n>1 show normal approx of the mean
    const vals = [];
    let maxY = 0;
    const xLo = 0, xHi = 2.6;
    for (let j = 0; j <= binN; j++) {
      const x = xLo + (j/binN)*(xHi-xLo);
      let y;
      if (n === 1) {
        y = x >= 0 ? Math.exp(-x) : 0;           // exponential population
      } else {
        y = Math.exp(-Math.pow((x-popMean)/sd, 2) / 2); // normal sampling dist of the mean
      }
      vals.push({x, y}); if (y>maxY) maxY=y;
    }
    const toX = x => pad.l + ((x-xLo)/(xHi-xLo))*cw;
    const toY = y => pad.t + ch - (y/maxY)*ch;
    // true-mean reference line
    ctx.beginPath(); ctx.moveTo(toX(popMean), pad.t); ctx.lineTo(toX(popMean), pad.t+ch);
    ctx.strokeStyle = RC.GR; ctx.lineWidth = 1.5; ctx.setLineDash([4,4]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = RC.GR; ctx.font = '600 10px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(T[currentLang].clt_truemean || 'true mean', toX(popMean), pad.t - 6);
    // fill (gradient)
    const fillHex = (n===1) ? RC.OR : RC.GR;
    ctx.beginPath(); ctx.moveTo(toX(xLo), pad.t+ch);
    vals.forEach(p => ctx.lineTo(toX(p.x), toY(p.y)));
    ctx.lineTo(toX(xHi), pad.t+ch); ctx.closePath();
    ctx.fillStyle = vGrad(ctx, fillHex, pad.t, pad.t+ch, 0.30, 0.03); ctx.fill();
    // line
    ctx.beginPath();
    vals.forEach((p,i) => i===0 ? ctx.moveTo(toX(p.x), toY(p.y)) : ctx.lineTo(toX(p.x), toY(p.y)));
    ctx.strokeStyle = fillHex; ctx.lineWidth = 2.5; ctx.stroke();
    // baseline
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t+ch); ctx.lineTo(pad.l+cw, pad.t+ch);
    ctx.strokeStyle = RC.MUTED; ctx.lineWidth = 1; ctx.stroke();
    // caption
    ctx.fillStyle = RC.INK; ctx.font = '600 11px Inter, sans-serif'; ctx.textAlign = 'center';
    const cap = (n===1)
      ? (T[currentLang].clt_cap_pop || 'n = 1: the raw population (very skewed)')
      : (T[currentLang].clt_cap_mean || 'distribution of the sample mean').replace('{n}', n);
    ctx.fillText(cap, pad.l + cw/2, H - 8);
  })();

  // ── Confidence interval narrows as n grows ──
  (function(){
    const c = initCanvas('chart-ci-n'); if(!c) return;
    const { ctx, W, H } = c;
    const pad = { t: 18, b: 42, l: 44, r: 16 };
    const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
    const p = 0.30;                          // illustrative conversion rate
    const nSel = parseInt(document.getElementById('ci-n-slider')?.value) || 1000;
    // x axis: n on a log scale from 100 to 20000; y axis: conversion rate 0..60%
    const nMin = 100, nMax = 20000;
    const logMin = Math.log(nMin), logMax = Math.log(nMax);
    const toX = n => pad.l + (Math.log(n)-logMin)/(logMax-logMin)*cw;
    const yMax = 0.6;
    const toY = v => pad.t + ch - (v/yMax)*ch;
    const hw = n => 1.96*Math.sqrt(p*(1-p)/n);
    // y gridlines
    ctx.textAlign='right'; ctx.font='600 9.5px Inter, sans-serif';
    [0,0.15,0.30,0.45,0.60].forEach(g=>{
      const y=toY(g);
      ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+cw,y);
      ctx.strokeStyle=RC.BORDER; ctx.lineWidth=0.8; ctx.setLineDash([2,3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle=RC.MUTED; ctx.fillText((g*100).toFixed(0)+'%', pad.l-8, y+3);
    });
    // true-rate reference line at 30%
    ctx.beginPath(); ctx.moveTo(pad.l,toY(p)); ctx.lineTo(pad.l+cw,toY(p));
    ctx.strokeStyle=RC.GR; ctx.lineWidth=1.5; ctx.setLineDash([5,4]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle=RC.GR; ctx.font='700 9px Inter, sans-serif'; ctx.textAlign='left';
    ctx.fillText('p = 30%', pad.l+4, toY(p)-5);
    // CI band (upper and lower envelopes) with gradient fill
    const upper=[], lower=[];
    for (let i=0;i<=100;i++){ const n=Math.exp(logMin+(logMax-logMin)*i/100); upper.push({x:toX(n),y:toY(p+hw(n))}); lower.push({x:toX(n),y:toY(p-hw(n))}); }
    ctx.beginPath(); ctx.moveTo(upper[0].x,upper[0].y);
    upper.forEach(pt=>ctx.lineTo(pt.x,pt.y));
    for (let i=lower.length-1;i>=0;i--) ctx.lineTo(lower[i].x,lower[i].y);
    ctx.closePath();
    const hxc=RC.P.replace('#',''); const rn=parseInt(hxc,16);
    ctx.fillStyle=`rgba(${(rn>>16)&255},${(rn>>8)&255},${rn&255},0.16)`; ctx.fill();
    // envelope lines
    [upper,lower].forEach(arr=>{ ctx.beginPath(); arr.forEach((pt,i)=>i===0?ctx.moveTo(pt.x,pt.y):ctx.lineTo(pt.x,pt.y)); ctx.strokeStyle=RC.P; ctx.lineWidth=1.8; ctx.stroke(); });
    // highlight selected n: vertical line + error bar + label
    const xs=toX(nSel), h=hw(nSel);
    ctx.beginPath(); ctx.moveTo(xs,pad.t); ctx.lineTo(xs,pad.t+ch);
    ctx.strokeStyle=RC.OR; ctx.lineWidth=1.5; ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
    // error bar at selected n
    ctx.strokeStyle=RC.OR; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(xs,toY(p+h)); ctx.lineTo(xs,toY(p-h)); ctx.stroke();
    [p+h,p-h].forEach(v=>{ ctx.beginPath(); ctx.moveTo(xs-5,toY(v)); ctx.lineTo(xs+5,toY(v)); ctx.stroke(); });
    ctx.beginPath(); ctx.arc(xs,toY(p),4,0,2*Math.PI); ctx.fillStyle=RC.OR; ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.stroke();
    // bubble
    const lab=`±${(h*100).toFixed(2)} pp`;
    ctx.font='700 10px Inter, sans-serif'; const tw=ctx.measureText(lab).width;
    let bx=xs+8; if (bx+tw+12>pad.l+cw) bx=xs-tw-20;
    ctx.fillStyle=RC.OR;
    if (ctx.roundRect){ctx.beginPath();ctx.roundRect(bx,toY(p+h)-22,tw+12,18,5);ctx.fill();} else ctx.fillRect(bx,toY(p+h)-22,tw+12,18);
    ctx.fillStyle='#fff'; ctx.textAlign='left'; ctx.fillText(lab,bx+6,toY(p+h)-9);
    // x ticks
    ctx.fillStyle=RC.MUTED; ctx.font='600 9px Inter, sans-serif'; ctx.textAlign='center';
    [100,500,2000,8000,20000].forEach(n=>ctx.fillText(n>=1000?(n/1000)+'k':n, toX(n), H-24));
    ctx.fillText(T[currentLang].cifac_axis || 'users per group (n) — log scale', pad.l+cw/2, H-8);
  })();

  // ── Total users vs treatment share (unequal split) ──
  (function(){
    const c = initCanvas('chart-split'); if(!c) return;
    const { ctx, W, H } = c;
    const pad = { t: 18, b: 42, l: 52, r: 16 };
    const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
    const p1 = 0.05, p2 = p1*1.10, delta = p2-p1;
    const zA = normInvCDF(0.975), zB = normInvCDF(0.80);
    // total users needed as a function of treatment fraction f (control = 1-f)
    function totalUsers(f){
      const r = (1-f)/f;                       // control / treatment ratio
      const pbar = (p1 + r*p2)/(1+r);
      const n_t = Math.pow(zA*Math.sqrt((1+1/r)*pbar*(1-pbar)) + zB*Math.sqrt(p1*(1-p1)/r + p2*(1-p2)), 2) / (delta*delta);
      const n_c = n_t * r;
      return Math.ceil(n_t) + Math.ceil(n_c);
    }
    const fMin = 0.05, fMax = 0.50;
    const fSel = (parseInt(document.getElementById('split-slider')?.value)||10)/100;
    // y range
    const totals = [];
    for (let f=fMin; f<=fMax+1e-9; f+=0.01) totals.push(totalUsers(f));
    const yMax = Math.max(...totals)*1.05;
    const toX = f => pad.l + (f-fMin)/(fMax-fMin)*cw;
    const toY = v => pad.t + ch - (v/yMax)*ch;
    // y gridlines
    ctx.textAlign='right'; ctx.font='600 9px Inter, sans-serif';
    for (let g=0; g<=4; g++){
      const val = yMax*g/4, y = toY(val);
      ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+cw,y);
      ctx.strokeStyle=RC.BORDER; ctx.lineWidth=0.8; ctx.setLineDash([2,3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle=RC.MUTED; ctx.fillText(Math.round(val/1000)+'k', pad.l-8, y+3);
    }
    // curve + fill
    const pts=[];
    for (let f=fMin; f<=fMax+1e-9; f+=0.005) pts.push({x:toX(f),y:toY(totalUsers(f))});
    ctx.beginPath(); ctx.moveTo(pts[0].x,toY(0));
    pts.forEach(pt=>ctx.lineTo(pt.x,pt.y));
    ctx.lineTo(pts[pts.length-1].x,toY(0)); ctx.closePath();
    ctx.fillStyle=vGrad(ctx,RC.P,pad.t,pad.t+ch,0.20,0.02); ctx.fill();
    ctx.beginPath(); pts.forEach((pt,i)=>i===0?ctx.moveTo(pt.x,pt.y):ctx.lineTo(pt.x,pt.y));
    ctx.strokeStyle=RC.P; ctx.lineWidth=2.5; ctx.stroke();
    // mark 50/50 (most efficient) at right edge
    ctx.fillStyle=RC.GR; ctx.font='700 9px Inter, sans-serif'; ctx.textAlign='center';
    ctx.fillText('50/50 ' + (T[currentLang].split_best||'(most efficient)'), toX(0.46), toY(totalUsers(0.5))-8);
    // highlight selected fraction
    const xs=toX(fSel), ys=toY(totalUsers(fSel));
    ctx.beginPath(); ctx.moveTo(xs,toY(0)); ctx.lineTo(xs,ys);
    ctx.strokeStyle=RC.OR; ctx.lineWidth=1.5; ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(xs,ys,5,0,2*Math.PI); ctx.fillStyle=RC.OR; ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke();
    const lab=Math.round(totalUsers(fSel)/1000)+'k';
    ctx.font='700 10px Inter, sans-serif'; const tw=ctx.measureText(lab).width;
    let bx=xs+8; if (bx+tw+12>pad.l+cw) bx=xs-tw-20;
    ctx.fillStyle=RC.OR; if(ctx.roundRect){ctx.beginPath();ctx.roundRect(bx,ys-22,tw+12,18,5);ctx.fill();}else ctx.fillRect(bx,ys-22,tw+12,18);
    ctx.fillStyle='#fff'; ctx.textAlign='left'; ctx.fillText(lab,bx+6,ys-9);
    // x ticks (share to variant)
    ctx.fillStyle=RC.MUTED; ctx.font='600 9px Inter, sans-serif'; ctx.textAlign='center';
    [0.05,0.1,0.2,0.3,0.4,0.5].forEach(f=>ctx.fillText(Math.round(f*100)+'%', toX(f), H-24));
    ctx.fillText(T[currentLang].split_axis || 'share of traffic sent to the variant', pad.l+cw/2, H-8);
  })();

  // ── FWER vs number of comparisons (multiple testing) ──
  (function(){
    const c = initCanvas('chart-fwer'); if(!c) return;
    const { ctx, W, H } = c;
    const pad = { t: 18, b: 42, l: 44, r: 16 };
    const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
    const mMax = 20, a = 0.05;
    const mSel = parseInt(document.getElementById('fwer-slider')?.value) || 3;
    const toX = m => pad.l + ((m-1)/(mMax-1))*cw;
    const toY = y => pad.t + ch - y*ch;          // y in [0,1]
    // horizontal gridlines + y labels (0,25,50,75,100%)
    ctx.textAlign = 'right'; ctx.font = '600 9.5px Inter, sans-serif';
    [0,0.25,0.5,0.75,1].forEach(g => {
      const y = toY(g);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l+cw, y);
      ctx.strokeStyle = RC.BORDER; ctx.lineWidth = 0.8; ctx.setLineDash([2,3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = RC.MUTED; ctx.fillText((g*100)+'%', pad.l-8, y+3);
    });
    // Bonferroni flat line at 5%
    const yB = toY(a);
    ctx.beginPath(); ctx.moveTo(pad.l, yB); ctx.lineTo(pad.l+cw, yB);
    ctx.strokeStyle = RC.GR; ctx.lineWidth = 2; ctx.setLineDash([5,4]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = RC.GR; ctx.font = '700 9.5px Inter, sans-serif'; ctx.textAlign='left';
    ctx.fillText(T[currentLang].mt_lbl_bonf || 'with Bonferroni (5%)', pad.l+6, yB-5);
    // FWER curve 1-(1-a)^m with gradient fill
    const pts = [];
    for (let m=1;m<=mMax;m++){ pts.push({ m, y: 1-Math.pow(1-a, m) }); }
    ctx.beginPath(); ctx.moveTo(toX(1), toY(0));
    pts.forEach(p=>ctx.lineTo(toX(p.m), toY(p.y)));
    ctx.lineTo(toX(mMax), toY(0)); ctx.closePath();
    ctx.fillStyle = vGrad(ctx, RC.OR, pad.t, pad.t+ch, 0.26, 0.02); ctx.fill();
    ctx.beginPath();
    pts.forEach((p,i)=> i===0?ctx.moveTo(toX(p.m),toY(p.y)):ctx.lineTo(toX(p.m),toY(p.y)));
    ctx.strokeStyle = RC.OR; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = RC.OR; ctx.font = '700 9.5px Inter, sans-serif'; ctx.textAlign='left';
    ctx.fillText(T[currentLang].mt_lbl_fwer || 'uncorrected FWER', toX(8), toY(pts[7].y)-8);
    // highlight the selected m: vertical guide + dot + value bubble
    const ySel = 1-Math.pow(1-a, mSel);
    const xSel = toX(mSel);
    ctx.beginPath(); ctx.moveTo(xSel, toY(0)); ctx.lineTo(xSel, toY(ySel));
    ctx.strokeStyle = RC.P; ctx.lineWidth = 1.5; ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(xSel, toY(ySel), 5, 0, 2*Math.PI);
    ctx.fillStyle = RC.P; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    // value bubble
    const label = `m=${mSel}: ${(ySel*100).toFixed(1)}%`;
    ctx.font = '700 10px Inter, sans-serif';
    const tw = ctx.measureText(label).width;
    let bx = xSel + 8; if (bx + tw + 12 > pad.l+cw) bx = xSel - tw - 20;
    const by = toY(ySel) - 22;
    ctx.fillStyle = RC.P;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, tw+12, 18, 5); ctx.fill(); }
    else ctx.fillRect(bx, by, tw+12, 18);
    ctx.fillStyle = '#fff'; ctx.textAlign='left'; ctx.fillText(label, bx+6, by+13);
    // x axis ticks + label
    ctx.fillStyle = RC.MUTED; ctx.font = '600 9.5px Inter, sans-serif'; ctx.textAlign='center';
    [1,5,10,15,20].forEach(m => ctx.fillText(m, toX(m), H-24));
    ctx.fillText(T[currentLang].mt_axis || 'number of simultaneous comparisons (m)', pad.l+cw/2, H-8);
  })();

  // Case-study mini charts live in the same Reference tab
  if (typeof drawCaseStudyCharts === 'function') drawCaseStudyCharts();
  if (typeof drawAnatomyCharts === 'function') drawAnatomyCharts();
}

// Draw reference charts on resize
window.addEventListener('resize', () => {
  if (document.getElementById('tab-reference').classList.contains('active')) drawCharts();
});

// Interactive slider handlers for the CUPED and peeking charts
document.addEventListener('DOMContentLoaded', () => {
  const cupedSlider = document.getElementById('cuped-slider');
  const cupedVal = document.getElementById('cuped-slider-val');
  if (cupedSlider) {
    cupedSlider.addEventListener('input', () => {
      if (cupedVal) cupedVal.textContent = cupedSlider.value + '%';
      if (document.getElementById('tab-reference')?.classList.contains('active')) drawCharts();
    });
  }
  const peekSlider = document.getElementById('peek-slider');
  const peekVal = document.getElementById('peek-slider-val');
  if (peekSlider) {
    peekSlider.addEventListener('input', () => {
      if (peekVal) peekVal.textContent = peekSlider.value;
      if (document.getElementById('tab-reference')?.classList.contains('active')) drawCharts();
    });
  }
  const cltSlider = document.getElementById('clt-slider');
  const cltVal = document.getElementById('clt-slider-val');
  if (cltSlider) {
    cltSlider.addEventListener('input', () => {
      if (cltVal) cltVal.textContent = cltSlider.value;
      if (document.getElementById('tab-reference')?.classList.contains('active')) drawCharts();
    });
  }

  // FWER (multiple-testing) interactive slider + live formula
  const fwerSlider = document.getElementById('fwer-slider');
  function updateFwerFormula() {
    if (!fwerSlider) return;
    const m = parseInt(fwerSlider.value) || 1;
    const fwer = 1 - Math.pow(1 - 0.05, m);
    const valEl = document.getElementById('fwer-slider-val');
    const mEl = document.getElementById('fwer-m');
    const resEl = document.getElementById('fwer-val');
    if (valEl) valEl.textContent = m;
    if (mEl) mEl.textContent = m;
    if (resEl) resEl.textContent = (fwer*100).toFixed(1) + '%';
    if (document.getElementById('tab-reference')?.classList.contains('active')) drawCharts();
  }
  if (fwerSlider) {
    fwerSlider.addEventListener('input', updateFwerFormula);
    updateFwerFormula();
  }

  // CI-vs-n interactive slider + live formula
  const ciSlider = document.getElementById('ci-n-slider');
  function updateCiFormula() {
    if (!ciSlider) return;
    const n = parseInt(ciSlider.value) || 1000;
    const hw = 1.96 * Math.sqrt(0.3*0.7/n);
    const valEl = document.getElementById('ci-n-slider-val');
    const nDisp = document.getElementById('ci-n-disp');
    const resEl = document.getElementById('ci-val');
    if (valEl) valEl.textContent = n.toLocaleString();
    if (nDisp) nDisp.textContent = n.toLocaleString();
    if (resEl) resEl.textContent = '±' + (hw*100).toFixed(2) + ' pp';
    if (document.getElementById('tab-reference')?.classList.contains('active')) drawCharts();
  }
  if (ciSlider) {
    ciSlider.addEventListener('input', updateCiFormula);
    updateCiFormula();
  }

  // Unequal-split interactive slider + live formula
  const splitSlider = document.getElementById('split-slider');
  function splitTotal(f){
    const p1=0.05, p2=p1*1.10, delta=p2-p1;
    const zA=normInvCDF(0.975), zB=normInvCDF(0.80);
    const r=(1-f)/f;
    const pbar=(p1+r*p2)/(1+r);
    const n_t=Math.pow(zA*Math.sqrt((1+1/r)*pbar*(1-pbar))+zB*Math.sqrt(p1*(1-p1)/r+p2*(1-p2)),2)/(delta*delta);
    return Math.ceil(n_t)+Math.ceil(n_t*r);
  }
  function updateSplitFormula(){
    if (!splitSlider) return;
    const f = (parseInt(splitSlider.value)||10)/100;
    const total = splitTotal(f);
    const mult = total / splitTotal(0.5);
    const valEl=document.getElementById('split-slider-val');
    const treatEl=document.getElementById('split-treat');
    const totalEl=document.getElementById('split-total');
    const multEl=document.getElementById('split-mult');
    if (valEl) valEl.textContent = Math.round(f*100)+'%';
    if (treatEl) treatEl.textContent = Math.round(f*100)+'%';
    if (totalEl) totalEl.textContent = total.toLocaleString();
    if (multEl) multEl.textContent = mult.toFixed(1)+'×';
    if (document.getElementById('tab-reference')?.classList.contains('active')) drawCharts();
  }
  if (splitSlider) {
    splitSlider.addEventListener('input', updateSplitFormula);
    updateSplitFormula();
  }
});

// ── Table-of-contents: scroll-spy highlighting + mobile toggle ──
document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('toc-sidebar');
  const toggle  = document.getElementById('toc-mobile-toggle');
  const links   = Array.from(document.querySelectorAll('.toc-nav .toc-link'));
  if (!links.length) return;

  // Map each section id -> its TOC link
  const linkFor = {};
  links.forEach(a => {
    const id = a.getAttribute('href').slice(1);
    linkFor[id] = a;
  });
  const sections = Object.keys(linkFor)
    .map(id => document.getElementById(id))
    .filter(Boolean);

  function setActive(id) {
    links.forEach(a => a.classList.remove('active'));
    const a = linkFor[id];
    if (a) {
      a.classList.add('active');
      // keep the active item visible inside a scrollable desktop sidebar
      if (window.innerWidth >= 1024) {
        const nav = document.getElementById('toc-nav');
        if (nav && nav.scrollHeight > nav.clientHeight) {
          const top = a.offsetTop - nav.clientHeight / 2;
          nav.scrollTo({ top, behavior: 'smooth' });
        }
      }
    }
  }

  // IntersectionObserver highlights whichever section is nearest the top
  let visible = new Map();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) visible.set(e.target.id, e.intersectionRatio);
      else visible.delete(e.target.id);
    });
    if (visible.size) {
      // pick the section closest to the top of the viewport
      let best = null, bestTop = Infinity;
      visible.forEach((ratio, id) => {
        const rect = document.getElementById(id).getBoundingClientRect();
        const dist = Math.abs(rect.top - 90);
        if (dist < bestTop) { bestTop = dist; best = id; }
      });
      if (best) setActive(best);
    }
  }, { rootMargin: '-80px 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] });

  sections.forEach(s => observer.observe(s));

  // Mobile collapsible toggle
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      const open = sidebar.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Scroll to the target for every TOC link.
  // The only real bug is on mobile: the drawer is a tall block at the top of the
  // page, so if we let the native #anchor jump run while it's open, the browser
  // scrolls to the target's open-drawer position, then the drawer collapses and
  // shifts everything up — landing the user too far down. Fix: prevent the
  // native jump, close the drawer first, wait for the collapse to finish, THEN
  // scrollIntoView against the settled layout. Desktop keeps the simple path.
  links.forEach(a => a.addEventListener('click', (ev) => {
    const id = a.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (!target) return;                 // anything odd: let the browser handle it
    ev.preventDefault();

    const go = () => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (history.replaceState) history.replaceState(null, '', '#' + id);
    };

    if (window.innerWidth < 1024 && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
      setTimeout(go, 340);             // wait out the 0.3s max-height transition
    } else {
      go();
    }
  }));

  // Highlight the first section initially
  setActive(sections[0]?.id);
});

// ── Interactive A/B process walkthrough ──
const PROCESS_STEPS = [
  { emoji: '💡', key: 'hypo' },
  { emoji: '📐', key: 'metric' },
  { emoji: '🔢', key: 'size' },
  { emoji: '🅰️', key: 'aacheck' },
  { emoji: '🚀', key: 'run' },
  { emoji: '📊', key: 'analyse' },
  { emoji: '🧭', key: 'decide' },
];
let processCurrent = 0;

function renderProcess() {
  const track = document.getElementById('process-track');
  const panel = document.getElementById('process-panel');
  const bar = document.getElementById('process-progress-bar');
  if (!track || !panel) return;
  const L = T[currentLang];

  // build step chips
  track.innerHTML = PROCESS_STEPS.map((s, i) => `
    <div class="process-step ${i===processCurrent?'active':''}" data-step="${i}">
      <span class="process-step-emoji">${s.emoji}</span>
      <span class="process-step-num">${(L.proc_step || 'Step')} ${i+1}</span>
      <span class="process-step-label">${L['proc_'+s.key+'_t'] || s.key}</span>
    </div>`).join('');

  // progress bar
  if (bar) bar.style.width = ((processCurrent+1) / PROCESS_STEPS.length * 100) + '%';

  // panel
  const s = PROCESS_STEPS[processCurrent];
  panel.innerHTML = `
    <div class="process-panel-title">${s.emoji} ${L['proc_'+s.key+'_t'] || ''}</div>
    <div class="process-panel-goal">${(L.proc_goal || 'Goal')}: ${L['proc_'+s.key+'_g'] || ''}</div>
    <div class="process-panel-body">${L['proc_'+s.key+'_b'] || ''}</div>
    <div class="process-example"><strong>${L.proc_example || 'Example'}:</strong> ${L['proc_'+s.key+'_e'] || ''}</div>
    <div class="process-nav">
      <button id="proc-prev" ${processCurrent===0?'disabled':''}>← ${L.proc_prev || 'Back'}</button>
      <button id="proc-next" class="primary" ${processCurrent===PROCESS_STEPS.length-1?'disabled':''}>${L.proc_next || 'Next'} →</button>
    </div>`;

  // wire chips + nav
  track.querySelectorAll('.process-step').forEach(el => {
    el.addEventListener('click', () => { processCurrent = parseInt(el.dataset.step); renderProcess(); });
  });
  const prev = document.getElementById('proc-prev');
  const next = document.getElementById('proc-next');
  if (prev) prev.addEventListener('click', () => { if (processCurrent>0){ processCurrent--; renderProcess(); } });
  if (next) next.addEventListener('click', () => { if (processCurrent<PROCESS_STEPS.length-1){ processCurrent++; renderProcess(); } });
}

document.addEventListener('DOMContentLoaded', renderProcess);

