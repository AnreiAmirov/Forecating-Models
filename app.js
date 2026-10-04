let currentLang = 'en';

function applyLang(lang) {
  currentLang = lang;
  // Mark the document language: screen readers pronounce text correctly,
  // and CSS can show the matching version of bilingual charts.
  document.documentElement.setAttribute('lang', lang);
  const dict = T[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = dict[key];
    if (val !== undefined) {
      // Some translation strings intentionally contain inline markup (<strong>, <em>, <sub>).
      // These are author-controlled (not user input), so rendering them as HTML is safe.
      if (/<[a-z][\s\S]*>/i.test(val)) el.innerHTML = val;
      else el.textContent = val;
    }
  });
  // Update lang button: always shows the OTHER language as the switch target
  document.getElementById('lang-label').textContent = lang === 'en' ? 'RU' : 'EN';
  document.documentElement.lang = lang;
  // Keep theme label in sync
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const themeLabelEl = document.getElementById('theme-label');
  if (themeLabelEl) themeLabelEl.textContent = isDark ? dict.theme_dark : dict.theme_light;
  try { localStorage.setItem('abcalc-lang', lang); } catch(e) {}
  // Redraw reference charts if visible (canvas labels need repaint)
  if (typeof drawCharts === 'function' &&
      document.getElementById('tab-reference')?.classList.contains('active')) {
    setTimeout(drawCharts, 10);
  }
  // Re-render the interactive process stepper (its content is i18n-driven)
  if (typeof renderProcess === 'function') renderProcess();

  // Result blocks are generated once as finished HTML and contain no [data-i18n]
  // hooks, so a language switch would otherwise leave a previously-calculated
  // result stranded in the old language. Recompute any visible result.
  try {
    const planRes = document.getElementById('plan-result');
    if (planRes && !planRes.classList.contains('hidden') && planRes.innerHTML.trim() &&
        typeof calcSampleSize === 'function') {
      calcSampleSize();
    }
    const revRes = document.getElementById('rev-result');
    if (revRes && !revRes.classList.contains('hidden') && revRes.innerHTML.trim() &&
        typeof reverseMDE === 'function') {
      reverseMDE();
    }
    const convRes = document.getElementById('conv-result');
    if (convRes && !convRes.classList.contains('hidden') && convRes.innerHTML.trim() &&
        typeof analyseConversion === 'function') {
      analyseConversion();
    }
    const contRes = document.getElementById('cont-result');
    if (contRes && !contRes.classList.contains('hidden') && contRes.innerHTML.trim() &&
        typeof analyseContinuous === 'function') {
      analyseContinuous();
    }
    const ratioRes = document.getElementById('ratio-result');
    if (ratioRes && !ratioRes.classList.contains('hidden') && ratioRes.innerHTML.trim() &&
        typeof analyseRatio === 'function') {
      analyseRatio();
    }
  } catch (e) { /* never let a re-render break the language switch */ }
}

function toggleLang() {
  applyLang(currentLang === 'en' ? 'ru' : 'en');
}

// Apply saved language on load — English is the default
(function() {
  try {
    const saved = localStorage.getItem('abcalc-lang');
    if (saved === 'ru') {
      window.addEventListener('DOMContentLoaded', () => applyLang('ru'));
    } else {
      // Ensure button shows RU (switch to Russian) and lang is EN
      window.addEventListener('DOMContentLoaded', () => {
        const lbl = document.getElementById('lang-label');
        if (lbl) lbl.textContent = 'RU';
      });
    }
  } catch(e) {}
})();

// ── Theme toggle ──
function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const icon = document.getElementById('theme-icon');
  const lbl  = document.getElementById('theme-label');
  if (icon) icon.textContent = dark ? '☀️' : '🌙';
  if (lbl)  lbl.textContent  = dark ? (T[currentLang]?.theme_light || 'Light') : (T[currentLang]?.theme_dark || 'Dark');
  if (typeof RC !== 'undefined') {
    // Core neutrals
    RC.INK    = dark ? '#f4f5ff' : '#1a1a2e';
    RC.MUTED  = dark ? '#8890b8' : '#9a9cb8';
    RC.BG     = dark ? '#161828' : '#ffffff';
    RC.BORDER = dark ? '#2e3155' : '#e2e4ef';
    // Semantic chart colours — must match the CSS variables for each theme
    RC.P    = dark ? '#a59cf7' : '#5b50c8';   // accent / purple
    RC.PL   = dark ? 'rgba(165,156,247,0.20)' : 'rgba(91,80,200,0.18)';
    RC.GR   = dark ? '#66dda0' : '#1a7a4a';   // success green
    RC.GRL  = dark ? 'rgba(102,221,160,0.20)' : 'rgba(26,122,74,0.15)';
    RC.OR   = dark ? '#f7a850' : '#e8832a';   // observed-marker orange
    RC.ORL  = dark ? 'rgba(247,168,80,0.20)' : 'rgba(232,131,42,0.18)';
    RC.RED  = dark ? '#ff6b6b' : '#dc3232';   // worse / rejection
    RC.REDL = dark ? 'rgba(255,107,107,0.20)' : 'rgba(220,50,50,0.15)';
    RC.WARN = dark ? '#f7cf50' : '#7a5500';   // warning
  }
  try { localStorage.setItem('abcalc-theme', dark ? 'dark' : 'light'); } catch(e) {}
  // Redraw any visible charts so they pick up the new colours immediately
  if (typeof drawCharts === 'function' &&
      document.getElementById('tab-reference')?.classList.contains('active')) {
    drawCharts();
  }
}
function toggleTheme() {
  const dark = document.documentElement.getAttribute('data-theme') !== 'dark';
  applyTheme(dark);
}
(function() {
  try {
    if (localStorage.getItem('abcalc-theme') === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      window.addEventListener('DOMContentLoaded', () => applyTheme(true));
    } else {
      // Explicitly initialise RC for light mode so charts match the UI
      window.addEventListener('DOMContentLoaded', () => applyTheme(false));
    }
  } catch(e) {}
})();

// ── URL State — encode inputs into query params ───────────────────────────

function encodeState() {
  try {
    const p = new URLSearchParams();
    const activeBtn = document.querySelector('.tab-btn.active');
    const tab = activeBtn?.getAttribute('data-tab') || 'plan';
    p.set('tab', tab);
    p.set('lang', currentLang);
    if (document.documentElement.getAttribute('data-theme') === 'dark') p.set('theme', 'dark');
    if (tab === 'plan') {
      const pm = planMetric || 'conversion';
      p.set('pm', pm);
      const getV = id => document.getElementById(id)?.value || '';
      const getR = name => document.querySelector(`input[name="${name}"]:checked`)?.value || '';
      p.set('pa', getR('p-alpha'));
      p.set('pp', getR('p-power'));
      p.set('pt', getR('p-tails'));
      if (pm === 'conversion') {
        p.set('cb', getV('p-conv-base'));
        p.set('cm', getV('p-conv-mde'));
      } else {
        p.set('cm2', getV('p-cont-mean'));
        p.set('cs', getV('p-cont-sd'));
        p.set('cme', getV('p-cont-mde'));
        p.set('cc', getV('p-cont-cuped'));
      }
      p.set('du', getV('p-daily-users'));
      p.set('nv', getV('p-num-variants'));
    }
    window.history.replaceState({}, '', window.location.pathname + '?' + p.toString());
  } catch(e) {}
}

function decodeState() {
  try {
    const p = new URLSearchParams(window.location.search);
    if (!p.has('tab')) return;
    if (p.get('theme') === 'dark') applyTheme(true);
    if (p.get('lang') === 'ru') applyLang('ru');
    const tab = p.get('tab') || 'plan';
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    if (tabBtn) {
      document.querySelectorAll('.tab-panel').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.btab').forEach(el => el.classList.remove('active'));
      document.getElementById('tab-' + tab)?.classList.add('active');
      tabBtn.classList.add('active');
      const btab = document.querySelector(`.btab[data-tab="${tab}"]`);
      if (btab) btab.classList.add('active');
      if (tab === 'reference') setTimeout(drawCharts, 30);
    }
    if (tab === 'plan') {
      const pm = p.get('pm') || 'conversion';
      planMetric = pm;
      document.querySelectorAll('.plan-metric-btn').forEach(b => b.classList.remove('selected'));
      document.getElementById(pm === 'conversion' ? 'plan-btn-conversion' : 'plan-btn-continuous')?.classList.add('selected');
      document.getElementById('plan-inputs-conversion')?.classList.toggle('hidden', pm !== 'conversion');
      document.getElementById('plan-inputs-continuous')?.classList.toggle('hidden', pm !== 'continuous');
      const setV = (id, val) => { if (val != null && val !== '') { const el = document.getElementById(id); if (el) el.value = val; } };
      const setR = (name, val) => { if (!val) return; const el = document.querySelector(`input[name="${name}"][value="${val}"]`); if (el) el.checked = true; };
      setR('p-alpha', p.get('pa')); setR('p-power', p.get('pp')); setR('p-tails', p.get('pt'));
      if (pm === 'conversion') { setV('p-conv-base', p.get('cb')); setV('p-conv-mde', p.get('cm')); }
      else { setV('p-cont-mean', p.get('cm2')); setV('p-cont-sd', p.get('cs')); setV('p-cont-mde', p.get('cme')); setV('p-cont-cuped', p.get('cc')); }
      setV('p-daily-users', p.get('du')); setV('p-num-variants', p.get('nv'));
      const hasData = (pm === 'conversion' && p.get('cb') && p.get('cm')) || (pm !== 'conversion' && p.get('cm2') && p.get('cs') && p.get('cme'));
      if (hasData) setTimeout(calcSampleSize, 150);
    }
  } catch(e) { console.warn('decodeState:', e); }
}

function copyShareLink() {
  encodeState();
  const url = window.location.href;
  const msg = T[currentLang]?.share_copied || 'Link copied!';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => showShareToast(msg)).catch(() => { fallbackCopy(url, msg); });
  } else { fallbackCopy(url, msg); }
}
function fallbackCopy(url, msg) {
  try {
    const el = document.createElement('textarea');
    el.value = url; el.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(el); el.select();
    document.execCommand('copy'); document.body.removeChild(el);
  } catch(e) {}
  showShareToast(msg || url);
}
function showShareToast(msg) {
  let t = document.getElementById('share-toast');
  if (!t) {
    t = document.createElement('div'); t.id = 'share-toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--accent);color:#fff;padding:10px 22px;border-radius:100px;font-size:0.85rem;font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.25);transition:opacity 0.3s;pointer-events:none';
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.opacity = '1';
  clearTimeout(t._timer); t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2500);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('change', encodeState);
    el.addEventListener('input', encodeState);
  });
  decodeState();
  renderRecentResults();
});


// ── Tabs ──
function showTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  // Sync top tab buttons
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  // Sync bottom tab buttons
  document.querySelectorAll('.btab').forEach(b => b.classList.remove('active'));
  // Mark the clicked button active (could be .tab-btn or .btab)
  btn.classList.add('active');
  // Also mark the counterpart button active
  const counterpart = document.querySelector(
    btn.classList.contains('btab') ? `.tab-btn[data-tab="${name}"]` : `.btab[data-tab="${name}"]`
  );
  if (counterpart) counterpart.classList.add('active');
  if (name === 'reference') setTimeout(drawCharts, 30);
  if (typeof encodeState === 'function') encodeState();
}

// ── Plan metric select ──
let planMetric = 'conversion';

// ── Traffic allocation (equal vs custom split) ──
let allocMode = 'equal';

function setAllocMode(mode) {
  allocMode = mode;
  document.getElementById('alloc-mode-equal').classList.toggle('selected', mode === 'equal');
  document.getElementById('alloc-mode-custom').classList.toggle('selected', mode === 'custom');
  document.getElementById('alloc-editor').classList.toggle('hidden', mode !== 'custom');
  if (mode === 'custom') renderAllocation();
}

function getVariantLabels(k) {
  return Array.from({ length: k }, (_, i) => String.fromCharCode(65 + i));
}

function renderAllocation() {
  const k = Math.max(2, Math.min(10, parseInt(document.getElementById('p-num-variants').value) || 2));
  const rowsEl = document.getElementById('alloc-rows');
  if (!rowsEl || allocMode !== 'custom') return;
  const labels = getVariantLabels(k);
  // default to an even split (rounded) unless rows already exist with the same count
  const existing = rowsEl.querySelectorAll('.alloc-pct-input');
  let values;
  if (existing.length === k) {
    values = Array.from(existing).map(i => parseFloat(i.value) || 0);
  } else {
    const even = Math.round(100 / k);
    values = labels.map((_, i) => i === k - 1 ? 100 - even * (k - 1) : even);
  }
  rowsEl.innerHTML = labels.map((lab, i) => `
    <div class="alloc-row">
      <span class="alloc-tag ${i === 0 ? 'control' : ''}">${lab}</span>
      <input type="range" class="alloc-slider" min="1" max="98" value="${values[i]}" data-idx="${i}" oninput="onAllocSlider(${i}, this.value)">
      <input type="number" class="alloc-pct-input" min="1" max="98" value="${values[i]}" data-idx="${i}" oninput="onAllocInput(${i}, this.value)">
    </div>`).join('');
  updateAllocSum();
}

function syncAllocRow(i, val) {
  const slider = document.querySelector(`.alloc-slider[data-idx="${i}"]`);
  const input = document.querySelector(`.alloc-pct-input[data-idx="${i}"]`);
  if (slider) slider.value = val;
  if (input) input.value = val;
}
function onAllocSlider(i, val) { syncAllocRow(i, val); updateAllocSum(); }
function onAllocInput(i, val) { syncAllocRow(i, val); updateAllocSum(); }

function getAllocWeights() {
  const inputs = document.querySelectorAll('#alloc-rows .alloc-pct-input');
  return Array.from(inputs).map(i => parseFloat(i.value) || 0);
}

function updateAllocSum() {
  const weights = getAllocWeights();
  const sum = weights.reduce((a, b) => a + b, 0);
  const sumEl = document.getElementById('alloc-sum');
  const warnEl = document.getElementById('alloc-warn');
  if (sumEl) {
    sumEl.textContent = sum + '%';
    sumEl.className = Math.abs(sum - 100) < 0.5 ? 'alloc-sum-ok' : 'alloc-sum-bad';
  }
  if (warnEl) warnEl.classList.toggle('hidden', Math.abs(sum - 100) < 0.5);
  return sum;
}

function selectPlanMetric(type, btn) {
  planMetric = type;
  document.querySelectorAll('.plan-metric-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('plan-inputs-conversion').classList.toggle('hidden', type !== 'conversion');
  document.getElementById('plan-inputs-continuous').classList.toggle('hidden', type !== 'continuous');
  document.getElementById('plan-ratio-notice').classList.toggle('hidden', type !== 'continuous');
  document.getElementById('plan-result').classList.add('hidden');
  const peEl = document.getElementById('plan-explain'); if (peEl) peEl.classList.add('hidden');
  const pemEl = document.getElementById('plan-empty'); if (pemEl) pemEl.classList.remove('hidden');
  const awEl = document.getElementById('res-arms-wrap'); if (awEl) awEl.classList.add('hidden');
}

// ── Analyse-tab "expected split" (drives the SRM check) ──
let srmMode = 'equal';

function setSrmMode(mode) {
  srmMode = mode;
  document.getElementById('srm-mode-equal').classList.toggle('selected', mode === 'equal');
  document.getElementById('srm-mode-custom').classList.toggle('selected', mode === 'custom');
  document.getElementById('srm-editor').classList.toggle('hidden', mode !== 'custom');
  if (mode === 'custom') renderSrmRows();
}

// Render one percentage input per current Analyse variant row, defaulting to even.
function renderSrmRows() {
  const rowsEl = document.getElementById('srm-rows');
  if (!rowsEl || srmMode !== 'custom') return;
  const k = document.querySelectorAll('#conv-variants .variant-row').length;
  const labels = getVariantLabels(k);
  const existing = rowsEl.querySelectorAll('.srm-pct-input');
  let values;
  if (existing.length === k) {
    values = Array.from(existing).map(i => parseFloat(i.value) || 0);
  } else {
    const even = Math.round(100 / k);
    values = labels.map((_, i) => i === k - 1 ? 100 - even * (k - 1) : even);
  }
  rowsEl.innerHTML = labels.map((lab, i) => `
    <div class="alloc-row">
      <span class="alloc-tag ${i === 0 ? 'control' : ''}">${lab}</span>
      <input type="range" class="alloc-slider srm-slider" min="1" max="98" value="${values[i]}" data-idx="${i}" oninput="onSrmSlider(${i}, this.value)">
      <input type="number" class="alloc-pct-input srm-pct-input" min="1" max="98" value="${values[i]}" data-idx="${i}" oninput="onSrmInput(${i}, this.value)">
    </div>`).join('');
  updateSrmSum();
}

function syncSrmRow(i, val) {
  const slider = document.querySelector(`.srm-slider[data-idx="${i}"]`);
  const input = document.querySelector(`.srm-pct-input[data-idx="${i}"]`);
  if (slider) slider.value = val;
  if (input) input.value = val;
}
function onSrmSlider(i, val) { syncSrmRow(i, val); updateSrmSum(); }
function onSrmInput(i, val) { syncSrmRow(i, val); updateSrmSum(); }

function getSrmWeights() {
  const inputs = document.querySelectorAll('#srm-rows .srm-pct-input');
  return Array.from(inputs).map(i => parseFloat(i.value) || 0);
}

function updateSrmSum() {
  const weights = getSrmWeights();
  const sum = weights.reduce((a, b) => a + b, 0);
  const sumEl = document.getElementById('srm-sum');
  const warnEl = document.getElementById('srm-warn');
  if (sumEl) {
    sumEl.textContent = Math.round(sum) + '%';
    sumEl.className = Math.abs(sum - 100) < 0.5 ? 'alloc-sum-ok' : 'alloc-sum-bad';
  }
  if (warnEl) warnEl.classList.toggle('hidden', Math.abs(sum - 100) < 0.5);
  return sum;
}

// ── Analyse metric select ──
let analyseMetric = 'conversion';
function selectAnalyseMetric(type, btn) {
  analyseMetric = type;
  document.querySelectorAll('#tab-analyse .plan-metric-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('analyse-section-conversion').classList.toggle('hidden', type !== 'conversion');
  document.getElementById('analyse-section-continuous').classList.toggle('hidden', type !== 'continuous');
  document.getElementById('analyse-section-ratio').classList.toggle('hidden', type !== 'ratio');
}

// ── Stats helpers ──

// ── Sample size + duration ──
// Reverse mode: given daily traffic and test length, find the smallest relative
// lift (MDE) detectable at the chosen alpha/power. Inverts the SAME formulas
// calcSampleSize() uses (bisection for conversion, closed form for continuous),
// so forward and reverse are always mutually consistent. Equal split assumed.
function reverseMDE() {
  const t = T[currentLang] || {};
  const box = document.getElementById('rev-result');
  if (!box) return;
  box.classList.remove('hidden');
  const show = (cls, html) => { box.classList.remove('hidden'); box.className = 'rev-result ' + cls; box.innerHTML = html; };

  // Read the shared Plan settings defensively — fall back to sensible defaults
  // if a control isn't found, so the button always produces a visible result.
  const rv = (sel, def) => { const el = document.querySelector(sel); return el ? el.value : def; };
  const alpha = parseFloat(rv('input[name="p-alpha"]:checked', '0.05')) || 0.05;
  const power = parseFloat(rv('input[name="p-power"]:checked', '0.8')) || 0.8;
  const tails = parseInt(rv('input[name="p-tails"]:checked', '2')) || 2;
  const nvEl = document.getElementById('p-num-variants');
  const numVariants = (nvEl && parseInt(nvEl.value)) || 2;
  const alphaAdj = alpha / Math.max(1, numVariants - 1);   // Bonferroni across variant-vs-control comparisons
  const zA = normInvCDF(tails === 2 ? 1 - alphaAdj/2 : 1 - alphaAdj);
  const zB = normInvCDF(power);

  const dailyEl = document.getElementById('rev-daily');
  const daysEl  = document.getElementById('rev-days');
  const daily = dailyEl ? parseFloat(dailyEl.value) : NaN;
  const days  = daysEl ? parseFloat(daysEl.value) : NaN;
  if (!daily || !days || daily <= 0 || days <= 0) { show('rev-err', t.rev_err_inputs || 'Enter daily eligible users and a test length in days first.'); return; }
  const nAvail = Math.floor(daily * days / numVariants);   // per arm, equal split
  if (nAvail < 10) { show('rev-err', t.rev_err_inputs || 'Enter daily eligible users and a test length in days first.'); return; }

  let relPct, absTxt;
  if (planMetric === 'conversion') {
    const baseEl = document.getElementById('p-conv-base');
    const p1 = baseEl ? parseFloat(baseEl.value) / 100 : NaN;
    if (!p1 || p1 <= 0 || p1 >= 1) { show('rev-err', t.rev_err_base || 'Fill in the baseline conversion rate above first.'); return; }
    // Same formula as calcSampleSize's conversion branch
    const needed = rel => {
      const p2 = Math.min(0.999999, p1 * (1 + rel));
      const pbar = (p1 + p2) / 2;
      return Math.pow(zA*Math.sqrt(2*pbar*(1-pbar)) + zB*Math.sqrt(p1*(1-p1)+p2*(1-p2)), 2) / Math.pow(p2 - p1, 2);
    };
    const relMax = (1/p1 - 1) * 0.999;                     // keeps p2 < 1
    if (needed(relMax) > nAvail) { show('rev-err', (t.rev_err_traffic || 'Not enough traffic: only {n} users per arm.').replace('{n}', nAvail.toLocaleString())); return; }
    let lo = 1e-4, hi = relMax;                            // needed() decreases in rel -> bisection
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (needed(mid) > nAvail) lo = mid; else hi = mid;
    }
    relPct = hi * 100;
    absTxt = (p1 * hi * 100).toFixed(2) + ' pp';
  } else {
    const muEl = document.getElementById('p-cont-mean');
    const sdEl = document.getElementById('p-cont-sd');
    const cupedEl = document.getElementById('p-cont-cuped');
    const mu = muEl ? parseFloat(muEl.value) : NaN;
    let sd = sdEl ? parseFloat(sdEl.value) : NaN;
    const cuped = ((cupedEl && parseFloat(cupedEl.value)) || 0) / 100;
    if (!mu || !sd || sd <= 0) { show('rev-err', t.rev_err_base || 'Fill in the mean and SD above first.'); return; }
    sd *= Math.sqrt(1 - cuped);
    const delta = (zA + zB) * sd * Math.sqrt(2 / nAvail);  // closed-form inverse of n = 2((zA+zB)sd/delta)^2
    relPct = delta / Math.abs(mu) * 100;
    absTxt = delta.toFixed(2) + ' ' + (t.rev_units || 'units');
  }

  const note = numVariants > 2 ? '<div class="rev-note">' + (t.rev_note_multi || '').replace('{k}', numVariants) + '</div>' : '';
  show('rev-ok',
    '<div class="rev-line"><strong>' + nAvail.toLocaleString() + '</strong> ' + (t.rev_res_n || 'users per arm available') + '</div>' +
    '<div class="rev-line rev-main"><strong>' + (relPct >= 10 ? relPct.toFixed(1) : relPct.toFixed(2)) + '%</strong> ' + (t.rev_res_rel || 'smallest detectable relative lift') + '</div>' +
    '<div class="rev-line"><strong>' + absTxt + '</strong> ' + (t.rev_res_abs || 'in absolute terms') + '</div>' +
    '<div class="rev-note">' + (t.rev_note || '') + '</div>' + note);
}

function calcSampleSize() {
  const alpha = parseFloat(document.querySelector('input[name="p-alpha"]:checked').value);
  const power = parseFloat(document.querySelector('input[name="p-power"]:checked').value);
  const tails = parseInt(document.querySelector('input[name="p-tails"]:checked').value);
  // With 3+ variants you compare each variant to control: (m-1) comparisons.
  // To hold the family-wise error rate, the per-comparison alpha is Bonferroni-adjusted,
  // which raises the required sample size per arm.
  const numVariants = parseInt(document.getElementById('p-num-variants').value) || 2;
  const numComparisons = Math.max(1, numVariants - 1);
  const alphaAdj = alpha / numComparisons;
  const zAlpha = normInvCDF(tails===2 ? 1-alphaAdj/2 : 1-alphaAdj);
  const zBeta  = normInvCDF(power);

  // Determine allocation weights (fractions summing to 1). Equal split by default.
  let weights;
  if (allocMode === 'custom') {
    const sum = updateAllocSum();
    if (Math.abs(sum - 100) >= 0.5) {
      showInlineError('plan-result', T[currentLang].plan_alloc_warn || 'Shares must add up to 100%.');
      return;
    }
    weights = getAllocWeights().map(w => w / 100);
  } else {
    weights = Array.from({ length: numVariants }, () => 1 / numVariants);
  }
  const isCustom = allocMode === 'custom';

  let n, mdeAbs, testName, baseRate, mdeRel;
  const L2 = T[currentLang] || {};   // i18n for test names / units in this function
  let armSizes = null;        // per-arm user counts (custom split)
  let totalUsers = null;      // experiment total
  let bottleneckIdx = -1;

  if (planMetric === 'conversion') {
    const p1 = parseFloat(document.getElementById('p-conv-base').value)/100;
    mdeRel = parseFloat(document.getElementById('p-conv-mde').value)/100;
    const p2 = p1*(1+mdeRel);
    mdeAbs = ((p2-p1)*100).toFixed(2)+' pp';
    const pbar = (p1+p2)/2;
    n = Math.ceil((zAlpha*Math.sqrt(2*pbar*(1-pbar))+zBeta*Math.sqrt(p1*(1-p1)+p2*(1-p2)))**2/(p2-p1)**2);
    testName = L2.test_z || 'Z-test';
    baseRate = p1;
    if (isCustom) {
      // Unequal split: size each control-vs-variant comparison given the allocation,
      // then take the total driven by the bottleneck (smallest) arm.
      const fC = weights[0], delta = p2 - p1;
      let maxTotal = 0;
      for (let i = 1; i < weights.length; i++) {
        const fV = weights[i];
        const r = fC / fV;                       // control / variant size ratio
        const pb = (p1 + r*p2) / (1 + r);
        const nV = Math.pow(zAlpha*Math.sqrt((1+1/r)*pb*(1-pb)) + zBeta*Math.sqrt(p1*(1-p1)/r + p2*(1-p2)), 2) / (delta*delta);
        const totalForThis = nV / fV;            // experiment total implied by this comparison
        if (totalForThis > maxTotal) { maxTotal = totalForThis; bottleneckIdx = i; }
      }
      totalUsers = Math.ceil(maxTotal);
      armSizes = weights.map(w => Math.ceil(totalUsers * w));
    }
  } else {
    const mu = parseFloat(document.getElementById('p-cont-mean').value);
    let sd = parseFloat(document.getElementById('p-cont-sd').value);
    mdeRel = parseFloat(document.getElementById('p-cont-mde').value)/100;
    const cupedPct = parseFloat(document.getElementById('p-cont-cuped').value)/100;
    sd *= Math.sqrt(1-cupedPct);
    const delta = mu*mdeRel;
    mdeAbs = delta.toFixed(2)+' '+(L2.rev_units || 'units');
    n = Math.ceil(2*((zAlpha+zBeta)*sd/delta)**2);
    testName = cupedPct>0 ? (L2.test_welch_cuped || "Welch's t + CUPED") : (L2.test_welch || "Welch's t-test");
    baseRate = null;
    if (isCustom) {
      // For a difference of means, per-comparison total with control fraction fC and
      // variant fraction fV: variance term (1/(N*fC) + 1/(N*fV)) must match the balanced
      // 2/n target, giving N = (sd^2 (zA+zB)^2 / delta^2) * (1/fC + 1/fV) for each comparison.
      const fC = weights[0];
      const base = Math.pow((zAlpha+zBeta)*sd/delta, 2);
      let maxTotal = 0;
      for (let i = 1; i < weights.length; i++) {
        const fV = weights[i];
        const totalForThis = base * (1/fC + 1/fV);
        if (totalForThis > maxTotal) { maxTotal = totalForThis; bottleneckIdx = i; }
      }
      totalUsers = Math.ceil(maxTotal);
      armSizes = weights.map(w => Math.ceil(totalUsers * w));
    }
  }

  // Headline number + total: equal split uses n*k; custom uses the bottleneck-driven total
  if (isCustom) {
    document.getElementById('res-n').textContent = armSizes[bottleneckIdx].toLocaleString();
    document.getElementById('res-total').textContent = totalUsers.toLocaleString();
  } else {
    document.getElementById('res-n').textContent = n.toLocaleString();
    document.getElementById('res-total').textContent = (n*numVariants).toLocaleString();
  }
  document.getElementById('res-mde-abs').textContent = mdeAbs;
  document.getElementById('res-test').textContent = testName;
  document.getElementById('plan-result').classList.remove('hidden');

  // Per-arm breakdown table (custom split only)
  const armsWrap = document.getElementById('res-arms-wrap');
  const armsBody = document.getElementById('res-arms-body');
  if (isCustom && armSizes) {
    const labels = getVariantLabels(weights.length);
    const ctrlWord = T[currentLang].lbl_control_word || 'control';
    armsBody.innerHTML = labels.map((lab, i) =>
      `<tr class="${i===bottleneckIdx?'bottleneck':''}"><td>${lab}${i===0?` (${ctrlWord})`:''}${i===bottleneckIdx?' 🔻':''}</td><td>${Math.round(weights[i]*100)}%</td><td>${armSizes[i].toLocaleString()}</td></tr>`
    ).join('');
    armsWrap.classList.remove('hidden');
    // relabel the headline meta for clarity
    document.getElementById('res-n').textContent = armSizes[bottleneckIdx].toLocaleString();
  } else {
    armsWrap.classList.add('hidden');
  }

  // Duration calculation
  const dailyRaw = parseFloat(document.getElementById('p-daily-users').value);
  const durationWrap = document.getElementById('res-duration-wrap');
  let explainDays = null;

  if (!isNaN(dailyRaw) && dailyRaw > 0) {
    // The slowest-filling arm sets the duration. Equal split: each arm gets dailyRaw/k.
    // Custom split: the bottleneck arm needs armSizes[bottleneckIdx] but only receives
    // dailyRaw * weights[bottleneckIdx] per day.
    let armDailyRate, armTarget;
    if (isCustom) {
      armDailyRate = dailyRaw * weights[bottleneckIdx];
      armTarget = armSizes[bottleneckIdx];
    } else {
      armDailyRate = dailyRaw / numVariants;
      armTarget = n;
    }
    const usersPerVariantPerDay = armDailyRate;
    const rawDays = Math.ceil(armTarget / usersPerVariantPerDay);
    // Always run whole weeks to capture weekly cycles (Kohavi et al.)
    const weeks = Math.max(2, Math.ceil(rawDays / 7));
    const days = weeks * 7;
    explainDays = days;

    document.getElementById('res-days').textContent = days;
    // Russian needs proper plural forms: 1 неделя / 2-4 недели / 5+ недель
    let weekWord;
    if (currentLang === 'ru') {
      const m10 = weeks % 10, m100 = weeks % 100;
      weekWord = (m10 === 1 && m100 !== 11) ? 'неделя'
               : (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) ? 'недели'
               : 'недель';
    } else {
      weekWord = weeks === 1 ? (L2.unit_week || 'week') : (L2.unit_weeks || 'weeks');
    }
    document.getElementById('res-weeks').textContent = weeks + ' ' + weekWord;
    document.getElementById('res-daily').textContent = Math.round(usersPerVariantPerDay).toLocaleString();

    // Contextual tips
    const tips = [];
    if (weeks > 8)  tips.push({ icon: '⚠️', text: L2.tip_long_test || 'Over 8 weeks is a long test. Consider raising α to 0.10 for faster iteration, or narrowing scope to a higher-traffic surface.' });
    if (weeks < 2)  tips.push({ icon: '⚠️', text: L2.tip_min_two_weeks || 'Always run for at least 2 full weeks to capture weekly seasonality. Short tests often produce misleading results.' });
    if (mdeRel && mdeRel < 0.03) tips.push({ icon: '💡', text: L2.tip_small_mde || 'Detecting a sub-3% lift requires a very large sample. Consider whether this effect size is truly worth shipping — or raise the MDE threshold.' });
    if (numVariants > 2) tips.push({ icon: '🔢', text: (L2.tip_multi_variant || 'With {k} variants you make {c} comparisons vs control. The sample size above already applies a Bonferroni-adjusted α = {a} per comparison, which is why each arm needs more users than a simple 2-group test.').replace('{k}', numVariants).replace('{c}', numComparisons).replace('{a}', alphaAdj.toFixed(4)) });
    if (isCustom) tips.push({ icon: '⏱️', text: (L2.tip_bottleneck || 'Duration is set by the smallest arm ({v}, {p}% of traffic) — it fills slowest, so it is the bottleneck.').replace('{v}', getVariantLabels(weights.length)[bottleneckIdx]).replace('{p}', Math.round(weights[bottleneckIdx]*100)) });
    if (planMetric === 'conversion' && baseRate < 0.02) tips.push({ icon: '⚠️', text: L2.tip_low_baseline || 'Very low baseline (<2%) means you need huge samples. Consider testing on a higher-converting funnel step first, or using a one-sided test if you only care about improvement.' });
    tips.push({ icon: '📅', text: L2.tip_calendar || 'Start on a Monday and end on a Sunday to ensure full weekly coverage. Avoid launching during atypical periods: holidays, campaigns, or major product changes.' });
    tips.push({ icon: '🔒', text: L2.tip_preregister || 'Pre-register your MDE and analysis plan before launch. Checking results daily and stopping early inflates false positives by up to 5×.' });

    const tipsHtml = tips.map(t =>
      `<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:7px">
        <span style="font-size:1rem;flex-shrink:0">${t.icon}</span>
        <span style="font-size:0.78rem;color:rgba(255,255,255,0.75);line-height:1.5">${t.text}</span>
      </div>`
    ).join('');
    document.getElementById('res-duration-tips').innerHTML = tipsHtml;
    durationWrap.classList.remove('hidden');
  } else {
    durationWrap.classList.add('hidden');
  }

  // ── Method line + "What this means" panel ──
  const L = T[currentLang];
  const confPct = Math.round((1 - alpha) * 100);
  const powerPct = Math.round(power * 100);
  const sided = tails === 2 ? (L.method_two_sided || 'two-sided') : (L.method_one_sided || 'one-sided');
  let methodStr;
  if (planMetric === 'conversion') {
    methodStr = (L.method_z || 'two-proportion Z-test, pooled variance, {c}% confidence, {p}% power ({s})');
  } else {
    methodStr = (L.method_t || "Welch's t-test (unequal variances), {c}% confidence, {p}% power ({s})");
  }
  methodStr = methodStr.replace('{c}', confPct).replace('{p}', powerPct).replace('{s}', sided);
  if (numVariants > 2) methodStr += ' · ' + (L.method_bonf || 'Bonferroni-adjusted for {k} comparisons').replace('{k}', numComparisons);
  if (isCustom) methodStr += ' · ' + (L.method_custom || 'sized on the smallest arm');
  document.getElementById('res-method').textContent = methodStr;

  // Build the plain-English bullets
  const items = [];
  const headlineN = isCustom ? armSizes[bottleneckIdx] : n;
  const nStr = '<b>' + headlineN.toLocaleString() + '</b>';
  if (planMetric === 'conversion') {
    const basePct = (baseRate*100).toFixed(1);
    const liftPct = (mdeRel*100).toFixed(0);
    items.push((L.explain_conv || 'You need {n} users per group to reliably detect a {lift}% relative lift on a {base}% baseline.')
      .replace('{n}', nStr).replace('{lift}', liftPct).replace('{base}', basePct));
  } else {
    const liftPct = (mdeRel*100).toFixed(0);
    items.push((L.explain_cont || 'You need {n} users per group to reliably detect a {lift}% change in the average.')
      .replace('{n}', nStr).replace('{lift}', liftPct));
  }
  if (isCustom) {
    const lab = getVariantLabels(weights.length)[bottleneckIdx];
    const pct = Math.round(weights[bottleneckIdx]*100);
    items.push((L.explain_bottleneck || 'Your {pct}% arm ({lab}) is the bottleneck — it forces the whole test to <b>{total}</b> users. Moving that arm closer to an equal share would cut the total.')
      .replace('{pct}', pct).replace('{lab}', lab).replace('{total}', totalUsers.toLocaleString()));
  }
  if (explainDays !== null) {
    items.push((L.explain_days || 'At your current traffic, that is about <b>{d} days</b> of testing.')
      .replace('{d}', explainDays));
  }
  items.push(L.explain_tradeoff || 'Smaller effects need far more traffic — halving the lift roughly quadruples the sample.');
  if (numVariants > 2 && !isCustom) {
    items.push((L.explain_multi || 'With {v} variants, each arm is sized for {k} corrected comparisons against control.')
      .replace('{v}', numVariants).replace('{k}', numComparisons));
  }
  document.getElementById('plan-explain-list').innerHTML = items.map(t => '<li>' + t + '</li>').join('');

  // Toggle empty state off, explanation on
  const emptyEl = document.getElementById('plan-empty');
  const explainEl = document.getElementById('plan-explain');
  if (emptyEl) emptyEl.classList.add('hidden');
  if (explainEl) explainEl.classList.remove('hidden');

  encodeState();
}

// ── Add / remove conversion variants (labels always follow position) ──
function relabelConvVariants() {
  const rows = document.querySelectorAll('#conv-variants .variant-row');
  rows.forEach((row, i) => {
    const tagEl = row.querySelector('.variant-tag');
    if (!tagEl) return;
    tagEl.textContent = String.fromCharCode(65 + i);   // A, B, C, …
    tagEl.classList.toggle('control', i === 0);         // only the first is control
  });
}

function removeConvVariant(btn) {
  const row = btn.closest('.variant-row');
  if (row) row.remove();
  relabelConvVariants();
  if (srmMode === 'custom') renderSrmRows();
}

function addConvVariant() {
  const div = document.createElement('div');
  div.className = 'variant-row';
  div.innerHTML = `<div class="variant-tag"></div>
    <div class="variant-inputs">
      <div class="vi-field"><label>${T[currentLang].lbl_exposed || 'Exposed'}</label><input type="number" class="cv-users" placeholder="5000" min="1"></div>
      <div class="vi-field"><label>${T[currentLang].lbl_converted || 'Converted'}</label><input type="number" class="cv-conv" placeholder="280" min="0"></div>
    </div>
    <button class="btn-remove" onclick="removeConvVariant(this)">×</button>`;
  document.getElementById('conv-variants').appendChild(div);
  relabelConvVariants();
  if (srmMode === 'custom') renderSrmRows();
}

// ── Inline validation message helper (replaces alert pop-ups) ──
function showInlineError(boxId, msg) {
  const box = document.getElementById(boxId);
  if (!box) return;
  box.innerHTML = `<div class="inline-msg"><span class="inline-msg-icon">⚠️</span><span>${msg}</span></div>`;
  box.classList.remove('hidden');
}

// ── Smooth-scroll to results on mobile after an analysis ──
function scrollToResultMobile(box) {
  if (!box || window.innerWidth > 640) return;  // mobile only
  setTimeout(() => {
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 60);
}

// ── Recent results (saved locally on this device) ──
const RECENT_KEY = 'abcalc-history';
const RECENT_MAX = 5;

function saveRecentResult(entry) {
  // entry: { type, verdict, status: 'win'|'lose'|'neutral', meta }
  let list = [];
  try { list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch(e) { list = []; }
  list.unshift({ ...entry, ts: Date.now() });
  list = list.slice(0, RECENT_MAX);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch(e) {}
  renderRecentResults();
}

function clearRecentResults() {
  try { localStorage.removeItem(RECENT_KEY); } catch(e) {}
  renderRecentResults();
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  const L = T[currentLang];
  if (s < 60) return L.recent_just_now;
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' ' + L.recent_min;
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' ' + L.recent_hr;
  const d = Math.floor(h / 24);
  return d + ' ' + L.recent_day;
}

function renderRecentResults() {
  const card = document.getElementById('recent-results-card');
  const listEl = document.getElementById('recent-results-list');
  if (!card || !listEl) return;
  let list = [];
  try { list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch(e) { list = []; }
  if (!list.length) { card.style.display = 'none'; return; }
  card.style.display = '';
  const colorFor = (st) => st === 'win' ? RC.GR : st === 'lose' ? RC.RED : RC.MUTED;
  listEl.innerHTML = list.map(item => {
    const inputsHtml = (item.inputs && item.inputs.length)
      ? `<div class="recent-item-inputs">${item.inputs.map(p =>
          `<div class="recent-input-row"><span class="recent-input-k">${p.k}</span><span class="recent-input-v">${p.v}</span></div>`
        ).join('')}</div>`
      : `<div class="recent-item-inputs"><div class="recent-input-row" style="color:var(--ink-faint)">${T[currentLang].recent_no_inputs}</div></div>`;
    return `
    <details class="recent-item">
      <summary class="recent-item-summary">
        <span class="recent-item-dot" style="background:${colorFor(item.status)}"></span>
        <div class="recent-item-main">
          <div class="recent-item-verdict">${item.verdict}</div>
          <div class="recent-item-meta">${item.type} · ${item.meta}</div>
        </div>
        <span class="recent-item-time">${timeAgo(item.ts)}</span>
      </summary>
      ${inputsHtml}
    </details>`;
  }).join('');
}

// ── Analyse conversion ──
function analyseConversion() {
  const alpha = parseFloat(document.querySelector('input[name="a-alpha"]:checked').value);
  const tails = parseInt(document.querySelector('input[name="a-tails"]:checked').value);
  const preregMDE = parseFloat(document.getElementById('a-prereg-mde').value)||null;
  const rows = document.querySelectorAll('#conv-variants .variant-row');
  const variants = [];
  for (const row of rows) {
    const n = parseFloat(row.querySelector('.cv-users').value);
    const c = parseFloat(row.querySelector('.cv-conv').value);
    if (isNaN(n)||isNaN(c)||n<=0){showInlineError('conv-result', T[currentLang].js_err_fill_variant);return;}
    variants.push({n,c,p:c/n});
  }
  if (variants.length<2){showInlineError('conv-result', T[currentLang].js_err_need_two);return;}
  const A = variants[0];

  // ── SRM (Sample Ratio Mismatch) health check ──
  // Compare observed arm sizes against the user's INTENDED split via a
  // chi-squared goodness-of-fit test. Default: equal split (today's behaviour).
  // Custom: the weights the user entered in the "Expected split" control, so a
  // deliberate 30/20/10 test is NOT falsely flagged.
  const srmBanner = (() => {
    const counts = variants.map(v => v.n);
    const total = counts.reduce((a,b)=>a+b,0);
    const k = counts.length;

    // Determine expected fractions. Equal unless a valid custom split is set.
    let fracs;
    let splitLabel;
    const L = T[currentLang];
    if (srmMode === 'custom') {
      const w = getSrmWeights();
      const wsum = w.reduce((a,b)=>a+b,0);
      // Only honour custom weights if they're present for every arm and sum to ~100.
      if (w.length === k && Math.abs(wsum - 100) < 0.5 && w.every(x => x > 0)) {
        fracs = w.map(x => x / 100);
        splitLabel = w.map(x => Math.round(x)).join('/');
      } else {
        // Invalid custom entry → fall back to equal and tell the user.
        fracs = Array.from({length:k}, () => 1/k);
        splitLabel = null;
      }
    } else {
      fracs = Array.from({length:k}, () => 1/k);
      splitLabel = null;
    }

    const expected = fracs.map(f => total * f);
    let chi2 = 0;
    for (let i = 0; i < k; i++) chi2 += (counts[i]-expected[i])**2/expected[i];
    const df = k - 1;
    // Wilson–Hilferty p-value
    const zChi = ((Math.cbrt(chi2/df))-(1-2/(9*df)))/Math.sqrt(2/(9*df));
    const pSRM = 1 - normCDF(zChi);

    const obsStr = counts.map(c => c.toLocaleString()).join(' / ');
    const expStr = expected.map(e => Math.round(e).toLocaleString()).join(' / ');
    const intended = splitLabel
      ? (L.srm_intended_custom || 'your intended {s} split').replace('{s}', splitLabel)
      : (L.srm_intended_equal || 'an even split');

    if (pSRM < 0.001) {
      const msg = (L.srm_bad || 'Sample Ratio Mismatch: arm sizes ({obs}) differ from {intended} (expected {exp}, p < 0.001). Assignment may be broken — results unreliable until fixed.')
        .replace('{obs}', obsStr).replace('{exp}', expStr).replace('{intended}', intended);
      return `<div class="srm-banner srm-bad">⚠ ${msg}</div>`;
    }
    const msg = (L.srm_ok || 'Split looks healthy: arm sizes ({obs}) are consistent with {intended} (expected {exp}, p = {p}).')
      .replace('{obs}', obsStr).replace('{exp}', expStr).replace('{intended}', intended)
      .replace('{p}', pSRM.toFixed(2));
    return `<div class="srm-banner srm-ok">✓ ${msg}</div>`;
  })();

  let html = `<div class="ar-header">${T[currentLang].js_results_conv}</div><div class="ar-body">${srmBanner}`;

  if (variants.length===2) {
    const B = variants[1];
    const se = Math.sqrt(A.p*(1-A.p)/A.n+B.p*(1-B.p)/B.n);
    const z = (B.p-A.p)/se;
    const pVal = tails===2?2*(1-normCDF(Math.abs(z))):1-normCDF(z);
    const sig = pVal<alpha;
    const liftPct = (B.p-A.p)/A.p*100;
    const ci95pp = 1.96*se*100;
    const preregWarn = preregMDE&&Math.abs(liftPct)<preregMDE&&sig
      ?`<div class="notice warn" style="margin-top:12px"><strong>Note:</strong> Significant, but the observed lift (${liftPct.toFixed(1)}%) is below your pre-registered MDE of ${preregMDE}%. Is this lift meaningful for the business?</div>`:'';

    // Low data warning: fewer than 100 conversions total, or fewer than 5 per variant
    const totalConversions = A.c + B.c;
    const minConversions = Math.min(A.c, B.c);
    const lowDataWarn = (totalConversions < 100 || minConversions < 5)
      ? `<div class="notice warn" style="margin-top:12px">
          <strong>${T[currentLang].js_low_data_title}</strong>
          ${T[currentLang].js_low_data_body.replace('{n}', totalConversions)}
        </div>` : '';

    const sigBetter = sig && liftPct > 0;  // significant AND variant is better
    const sigWorse  = sig && liftPct < 0;  // significant AND variant is worse
    const verdictClass = sigBetter ? 'sig' : sigWorse ? 'worse' : 'insig';
    const verdictText  = sigBetter ? T[currentLang].js_ship
                       : sigWorse  ? T[currentLang].js_variant_worse
                       : T[currentLang].js_no_winner;
    html += `<div class="ar-verdict ${verdictClass}">${verdictText}</div>`;
    html += `<div class="ar-sub">p = ${pVal.toFixed(4)} · α = ${alpha} · ${tails===2?T[currentLang].js_two_sided:T[currentLang].js_one_sided}</div>`;
    // Sticky verdict bar — visible only on mobile (CSS hides it on desktop)
    html += `<div class="ar-sticky-verdict">
      <div class="ar-verdict ${verdictClass}">${verdictText}</div>
      <div class="ar-sub">p=${pVal.toFixed(4)}</div>
    </div>`;
    html += `<div class="ar-stats">
      <div class="ar-stat"><strong>${(A.p*100).toFixed(2)}%</strong>${T[currentLang].js_control_rate}</div>
      <div class="ar-stat"><strong>${(B.p*100).toFixed(2)}%</strong>${T[currentLang].js_variant_rate}</div>
      <div class="ar-stat"><strong>${liftPct>0?'+':''}${liftPct.toFixed(1)}%</strong>${T[currentLang].js_rel_lift}</div>
      <div class="ar-stat"><strong>±${ci95pp.toFixed(2)} pp</strong>${T[currentLang].js_margin}</div>
    </div>${lowDataWarn}${preregWarn}`;

    // Chart canvases — drawn after innerHTML is set
    html += `<div class="res-chart-grid">
      <div class="chart-card" style="margin-bottom:0">
        <div class="chart-title">Conversion rates with 95% confidence intervals</div>
        <div class="chart-sub">Bars are observed rates; whiskers are CIs. Non-overlapping intervals roughly imply a significant difference.</div>
        <div class="chart-wrap"><canvas id="res-chart-conv-bars"></canvas></div>
      </div>
      <div class="chart-card" style="margin-bottom:0">
        <div class="chart-title">How your observed difference compares to the null distribution</div>
        <div class="chart-sub">Under H₀ the difference should sit near zero. The orange marker is what you observed — the red areas are rejection zones at α = ${alpha}.</div>
        <div class="chart-wrap"><canvas id="res-chart-conv-lift"></canvas></div>
      </div>
    </div>`;

    html += '</div>';

    // Data table — same structure as t-test table
    // For a proportion p, SD = sqrt(p*(1-p)), CV = SD/p
    const sdA = Math.sqrt(A.p*(1-A.p));
    const sdB = Math.sqrt(B.p*(1-B.p));
    const cvA = sdA / A.p;
    const cvB = sdB / B.p;
    const ciAlo = ((A.p - 1.96*Math.sqrt(A.p*(1-A.p)/A.n))*100).toFixed(2);
    const ciAhi = ((A.p + 1.96*Math.sqrt(A.p*(1-A.p)/A.n))*100).toFixed(2);
    const ciBlo = ((B.p - 1.96*Math.sqrt(B.p*(1-B.p)/B.n))*100).toFixed(2);
    const ciBhi = ((B.p + 1.96*Math.sqrt(B.p*(1-B.p)/B.n))*100).toFixed(2);
    const pDisplay = pVal < 0.0001 ? '< 0.0001' : pVal.toFixed(4);
    html += `<div class="scroll-x" style="margin-top:16px">
      <table class="ref-table" style="min-width:520px">
        <thead><tr>
          <th>Variant</th><th>n</th><th>Rate</th><th>SD</th><th>CV</th>
          <th>95% CI</th><th>Δ vs A</th><th>P-value</th>
        </tr></thead>
        <tbody>
          <tr>
            <td><span style="color:${RC.P};font-weight:700">◆ A</span></td>
            <td>${A.n.toLocaleString()}</td>
            <td><strong>${(A.p*100).toFixed(2)}%</strong></td>
            <td>${(sdA*100).toFixed(2)}%</td>
            <td>${cvA.toFixed(2)}</td>
            <td>[${ciAlo}%, ${ciAhi}%]</td>
            <td>—</td><td>—</td>
          </tr>
          <tr style="background:${sigBetter?'rgba(26,122,74,0.06)':sigWorse?'rgba(220,50,50,0.06)':'rgba(91,80,200,0.04)'}">
            <td><span style="color:${sigBetter?RC.GR:sigWorse?RC.RED:RC.P};font-weight:700">${sigBetter?'★':sigWorse?'▼':'◆'} B</span></td>
            <td>${B.n.toLocaleString()}</td>
            <td><strong>${(B.p*100).toFixed(2)}%</strong></td>
            <td>${(sdB*100).toFixed(2)}%</td>
            <td>${cvB.toFixed(2)}</td>
            <td>[${ciBlo}%, ${ciBhi}%]</td>
            <td style="color:${sig?RC.GR:RC.MUTED};font-weight:600">${liftPct>0?'+':''}${liftPct.toFixed(2)}%</td>
            <td style="color:${sig?RC.GR:RC.MUTED};font-weight:600">${pDisplay}</td>
          </tr>
        </tbody>
      </table>
    </div>`;

    if (sigBetter) {
      html += `<div class="notice success" style="margin-top:12px">
        <strong>${T[currentLang].js_before_ship}</strong>
        <ul style="margin-top:6px;padding-left:16px">
          <li>${T[currentLang].js_guardrails}</li>
          <li>${T[currentLang].js_segments}</li>
        </ul>
      </div>`;
    } else {
      html += `<div class="notice info" style="margin-top:12px">
        <strong>${T[currentLang].js_not_sig}</strong> ${T[currentLang].js_keep_running}
      </div>`;
    }

    // ── Revenue projection ──────────────────────────────────────────────
    const monthlyVisitors = parseFloat(document.getElementById('a-monthly-visitors')?.value);
    const avgOrder        = parseFloat(document.getElementById('a-avg-order')?.value);
    if (monthlyVisitors > 0 && avgOrder > 0) {
      const liftAbs    = B.p - A.p;                          // absolute lift in conversion rate
      const extraConvPerMonth = liftAbs * monthlyVisitors;   // extra conversions per month
      const extraRevMonth  = extraConvPerMonth * avgOrder;   // extra revenue per month
      const extraRevYear   = extraRevMonth * 12;             // annualised
      // Conservative / expected / optimistic based on 95% CI of the lift
      const liftLo   = liftAbs - 1.96 * se;
      const liftHi   = liftAbs + 1.96 * se;
      const revLo    = Math.max(0, liftLo) * monthlyVisitors * avgOrder * 12;
      const revHi    = liftHi  * monthlyVisitors * avgOrder * 12;
      const fmt = (n) => n >= 1e6
        ? '$' + (n/1e6).toFixed(1) + 'M'
        : n >= 1e3
          ? '$' + Math.round(n/1e3) + 'k'
          : '$' + Math.round(n);

      html += `<div class="revenue-card">
        <div class="revenue-title">${T[currentLang].js_revenue_title}</div>
        <div class="revenue-cols">
          <div class="rev-col">
            <div class="rev-val rev-lo">${fmt(revLo)}</div>
            <div class="rev-label">${T[currentLang].js_rev_conservative}</div>
          </div>
          <div class="rev-col rev-col-mid">
            <div class="rev-val rev-mid">${fmt(extraRevYear)}</div>
            <div class="rev-label">${T[currentLang].js_rev_expected}</div>
          </div>
          <div class="rev-col">
            <div class="rev-val rev-hi">${fmt(revHi)}</div>
            <div class="rev-label">${T[currentLang].js_rev_optimistic}</div>
          </div>
        </div>
        <div class="rev-note">${T[currentLang].js_rev_note
          .replace('{lift}', (liftAbs*100).toFixed(2))
          .replace('{visitors}', monthlyVisitors.toLocaleString())
          .replace('{aov}', avgOrder.toFixed(0))}</div>
      </div>`;
    }

    const box=document.getElementById('conv-result');
    box.innerHTML=html; box.classList.remove('hidden');
    setTimeout(()=>drawConvCharts(A,B,se,z,pVal,sig,alpha,tails), 20);
    scrollToResultMobile(box);
    saveRecentResult({
      type: T[currentLang].js_results_conv,
      verdict: verdictText,
      status: sigBetter ? 'win' : sigWorse ? 'lose' : 'neutral',
      meta: `${(B.p*100).toFixed(2)}% vs ${(A.p*100).toFixed(2)}% · ${liftPct>0?'+':''}${liftPct.toFixed(1)}% · p=${pVal.toFixed(3)}`,
      inputs: [
        { k: T[currentLang].ri_control, v: `${A.n.toLocaleString()} ${T[currentLang].ri_users}, ${A.c.toLocaleString()} ${T[currentLang].ri_conv} (${(A.p*100).toFixed(2)}%)` },
        { k: T[currentLang].ri_variant, v: `${B.n.toLocaleString()} ${T[currentLang].ri_users}, ${B.c.toLocaleString()} ${T[currentLang].ri_conv} (${(B.p*100).toFixed(2)}%)` },
        { k: T[currentLang].ri_settings, v: `α=${alpha}, ${tails===2?T[currentLang].js_two_sided:T[currentLang].js_one_sided}` },
      ],
    });

  } else {
    // multi-variant
    const total=variants.reduce((s,v)=>s+v.n,0);
    const totalConv=variants.reduce((s,v)=>s+v.c,0);
    const pPool=totalConv/total;
    let chi2=0;
    for(const v of variants){const exp=v.n*pPool;chi2+=(v.c-exp)**2/exp+((v.n-v.c)-v.n*(1-pPool))**2/(v.n*(1-pPool));}
    const df=variants.length-1;
    // Wilson–Hilferty approximation: ((χ²/df)^(1/3) - (1 - 2/(9df))) / sqrt(2/(9df)) ~ N(0,1)
    const zChi=((Math.cbrt(chi2/df))-(1-2/(9*df)))/Math.sqrt(2/(9*df));
    const pChi=1-normCDF(zChi);
    const sigChi=pChi<alpha;
    html+=`<div class="ar-verdict ${sigChi?'sig':'insig'}">${sigChi?T[currentLang].js_variants_diff:T[currentLang].js_no_diff}</div>`;
    html+=`<div class="ar-sub">χ²(${df}) = ${chi2.toFixed(3)}, p = ${pChi.toFixed(4)}</div>`;

    // Multi-variant bar chart
    html += `<div style="margin-top:16px">
      <div style="font-size:0.72rem;font-weight:700;color:var(--ink-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Conversion rate by variant</div>
      <div style="position:relative;height:160px"><canvas id="res-chart-multi-bars"></canvas></div>
    </div>`;

    if(sigChi){
      // Holm–Bonferroni step-down across the (m-1) variant-vs-control comparisons.
      const k = variants.length - 1;
      // 1) compute raw p-values and lifts for each variant vs control A
      const comps = variants.map((v, i) => {
        if (i === 0) return null;
        const seAB = Math.sqrt(A.p*(1-A.p)/A.n + v.p*(1-v.p)/v.n);
        const zAB = (v.p - A.p) / seAB;
        const pvAB = 2*(1-normCDF(Math.abs(zAB)));
        return { i, p: pvAB, lift: (v.p-A.p)/A.p*100 };
      });
      // 2) Holm step-down: sort ascending, threshold alpha/(k-rank), stop at first non-rejection
      const ordered = comps.filter(Boolean).slice().sort((a,b)=>a.p-b.p);
      const holmSig = {};
      let stillRejecting = true;
      ordered.forEach((c, rank) => {
        const thr = alpha / (k - rank);
        c.thr = thr;
        const rejected = stillRejecting && c.p < thr;
        holmSig[c.i] = rejected;
        if (!rejected) stillRejecting = false;
      });
      // 3) pick the best variant to highlight: highest rate among Holm-significant winners
      //    (positive lift); if none significant, highlight the highest observed rate.
      let bestIdx = -1, bestRate = -Infinity;
      variants.forEach((v, i) => {
        const qualifies = i === 0 ? false : (holmSig[i] && comps[i].lift > 0);
        if (qualifies && v.p > bestRate) { bestRate = v.p; bestIdx = i; }
      });
      if (bestIdx === -1) { // no significant winner — flag the top raw rate (non-committal)
        variants.forEach((v, i) => { if (v.p > bestRate) { bestRate = v.p; bestIdx = i; } });
      }
      const anyWinner = Object.values(holmSig).some(Boolean);

      if (anyWinner && bestIdx > 0) {
        html += `<div class="best-variant-banner">🏆 ${T[currentLang].js_best_variant || 'Best variant'}: <strong>${String.fromCharCode(65+bestIdx)}</strong> — ${(variants[bestIdx].p*100).toFixed(2)}% (${comps[bestIdx].lift>0?'+':''}${comps[bestIdx].lift.toFixed(1)}% ${T[currentLang].js_vs_control || 'vs control'})</div>`;
      }

      // Full table for all variants
      html += `<div class="scroll-x" style="margin-top:16px">
        <table class="ref-table" style="min-width:560px">
          <thead><tr>
            <th>Variant</th><th>n</th><th>Rate</th><th>SD</th><th>CV</th>
            <th>95% CI</th><th>Δ vs A</th><th>P-value</th><th>${T[currentLang].js_holm_col || 'Holm'}</th>
          </tr></thead><tbody>`;
      variants.forEach((v, i) => {
        const tag = String.fromCharCode(65+i);
        const sd = Math.sqrt(v.p*(1-v.p));
        const cv = sd / v.p;
        const cilo = ((v.p - 1.96*Math.sqrt(v.p*(1-v.p)/v.n))*100).toFixed(2);
        const cihi = ((v.p + 1.96*Math.sqrt(v.p*(1-v.p)/v.n))*100).toFixed(2);
        let liftTd = '—', pTd = '—', holmTd = '—';
        if (i > 0) {
          const c = comps[i];
          const sig = holmSig[i];
          const col = sig ? RC.GR : RC.MUTED;
          liftTd = `<span style="color:${col};font-weight:600">${c.lift>0?'+':''}${c.lift.toFixed(2)}%</span>`;
          pTd = `<span style="color:${col};font-weight:600">${c.p<0.0001?'< 0.0001':c.p.toFixed(4)}</span>`;
          holmTd = sig ? `<span style="color:${RC.GR};font-weight:700">✓ ${T[currentLang].js_holm_sig || 'significant'}</span>`
                       : `<span style="color:var(--ink-faint)">${T[currentLang].js_holm_ns || 'not sig.'}</span>`;
        }
        const isBest = (i === bestIdx && anyWinner && bestIdx > 0);
        const rowStyle = isBest ? `style="background:${RC.GRL || 'rgba(26,122,74,0.10)'}"`
                                : (i===0 ? '' : `style="background:rgba(91,80,200,0.03)"`);
        html += `<tr ${rowStyle}>
          <td><span style="color:${RC.P};font-weight:700">${isBest?'🏆':(i===0?'◆':'◇')} ${tag}${i===0?` <small style="font-weight:400;color:var(--ink-faint)">(${T[currentLang].lbl_control_word||'control'})</small>`:''}</span></td>
          <td>${v.n.toLocaleString()}</td>
          <td><strong>${(v.p*100).toFixed(2)}%</strong></td>
          <td>${(sd*100).toFixed(2)}%</td>
          <td>${cv.toFixed(2)}</td>
          <td>[${cilo}%, ${cihi}%]</td>
          <td>${liftTd}</td>
          <td>${pTd}</td>
          <td>${holmTd}</td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
      html += `<p style="font-size:0.78rem;color:var(--ink-faint);margin-top:8px">${(T[currentLang].js_holm_note || 'Pairwise comparisons (each variant vs control A) use the Holm–Bonferroni step-down correction across {k} comparisons — uniformly more powerful than plain Bonferroni while controlling the family-wise error rate at α = {a}.').replace('{k}', k).replace('{a}', alpha)}</p>`;
    }
    html+='</div>';
    const box=document.getElementById('conv-result');
    box.innerHTML=html; box.classList.remove('hidden');
    setTimeout(()=>drawMultiConvChart(variants), 20);
    scrollToResultMobile(box);
  }
}

// ── Toggle summary stat inputs ──
function toggleSummaryInputs(tag) {
  const ids = { A:'cont-summary-A', B:'cont-summary-B', ratioA:'ratio-summary-A', ratioB:'ratio-summary-B' };
  const el = document.getElementById(ids[tag]);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'grid' : 'none';
}

// ── Parse a variant block (textarea or summary stats) ──
function parseBlock(block) {
  const ta = block.querySelector('.cv-raw-ta');
  const raw = ta ? ta.value.trim() : '';
  if (raw) {
    const vals = raw.split(/[\s,;]+/).map(Number).filter(v => !isNaN(v));
    if (vals.length < 2) return null;
    const m = mean(vals);
    const sd = Math.sqrt(variance(vals));
    return { vals, mean: m, sd, n: vals.length };
  }
  const m = parseFloat(block.querySelector('.cv-mean')?.value);
  const s = parseFloat(block.querySelector('.cv-sd')?.value);
  const n = parseFloat(block.querySelector('.cv-n')?.value);
  if (isNaN(m)||isNaN(s)||isNaN(n)||s<0||n<2) return null;
  return { mean: m, sd: s, n };
}

// ── Variance diagnostics ──
function skewness(vals) {
  const n = vals.length, m = mean(vals);
  const s = Math.sqrt(vals.reduce((a,v)=>a+(v-m)**2,0)/n);
  if (s === 0) return 0;
  return vals.reduce((a,v)=>a+((v-m)/s)**3,0)/n;
}

function varianceDiagnostics(A, B) {
  const warnings = [];
  const cvA = A.sd / Math.abs(A.mean);
  const cvB = B.sd / Math.abs(B.mean);
  const varRatio = A.sd > 0 && B.sd > 0 ? Math.max(A.sd**2, B.sd**2) / Math.min(A.sd**2, B.sd**2) : 1;
  const minN = Math.min(A.n, B.n);

  // Small-sample + genuinely skewed raw data: the t-test may be fragile here.
  // True third-moment skewness (only computable when raw values were pasted).
  if (A.vals && B.vals && minN < 200) {
    const skA = skewness(A.vals), skB = skewness(B.vals);
    const maxSk = Math.max(Math.abs(skA), Math.abs(skB));
    if (maxSk > 2) {
      warnings.push({ level:'warn', text:
        (T[currentLang].an_skew_warn || '')
          .replace('{n}', minN)
          .replace('{sk}', maxSk.toFixed(1))
      });
    }
  }

  if (cvA > 1 || cvB > 1) {
    const which = cvA > cvB ? `A (CV=${cvA.toFixed(2)})` : `B (CV=${cvB.toFixed(2)})`;
    warnings.push({ level:'warn', text:
      `<strong>High variance in variant ${which}:</strong> the standard deviation exceeds the mean, which usually means a heavy-tailed distribution — a few whale users dominating. Welch's t-test still works at large n, but consider <strong>winsorising at the 99th percentile</strong> to cap outliers, or using <strong>CUPED</strong> with pre-experiment data to reduce variance by 30–50%. Both reduce noise without biasing your result.`
    });
  }

  if (varRatio > 4) {
    warnings.push({ level:'warn', text:
      `<strong>Unequal variances:</strong> one group's variance is ${varRatio.toFixed(1)}× larger than the other's. Welch's t handles this correctly (unlike Student's t), so the p-value is still valid. But the large variance difference itself is a finding — the variant may affect some users much more than others.`
    });
  }

  if (minN < 30 && (cvA > 0.5 || cvB > 0.5)) {
    warnings.push({ level:'warn', text:
      `<strong>Small sample + skewed data (n = ${minN}):</strong> the Central Limit Theorem hasn't fully applied yet. Consider <strong>Mann–Whitney U</strong> — it's more reliable than t-test when n < 30 and data is non-normal. It tests whether values in B tend to be higher than in A, without assuming a distribution shape.`
    });
  } else if (minN < 200 && (cvA > 1 || cvB > 1)) {
    warnings.push({ level:'info', text:
      `With n = ${minN} and high variance you may have low power. Even if p > 0.05, a real effect might exist but be invisible at this sample size. Run the sample size calculator to check how much data you actually need.`
    });
  }

  if (A.vals && B.vals) {
    const zerosA = A.vals.filter(v => v === 0).length / A.n;
    const zerosB = B.vals.filter(v => v === 0).length / B.n;
    if (zerosA > 0.3 || zerosB > 0.3) {
      warnings.push({ level:'warn', text:
        `<strong>${Math.round(Math.max(zerosA,zerosB)*100)}% of values are zero</strong> — zero-inflated distribution, common for revenue. Welch's t still works at large n, but consider separating the analysis: (1) <strong>conversion test</strong> — did they buy at all? (use Z-test), then (2) <strong>average value among buyers only</strong> — how much did they spend? This gives cleaner, more actionable signals.`
      });
    }
  }
  return warnings;
}

function renderDiagnostics(warnings) {
  if (!warnings.length) return '';
  return warnings.map(w =>
    `<div class="notice ${w.level === 'warn' ? 'warn' : 'info'}" style="margin-top:10px;font-size:0.82rem;line-height:1.55">${w.text}</div>`
  ).join('');
}

// ── Shared t-test result builder ──
function runWelchT(A, B, alpha, tails, resultBoxId, chartBarId, chartNullId, headerLabel, fmtFn) {
  const se   = Math.sqrt(A.sd**2/A.n + B.sd**2/B.n);
  const t    = (B.mean - A.mean) / se;
  const df   = (A.sd**2/A.n + B.sd**2/B.n)**2 / ((A.sd**2/A.n)**2/(A.n-1) + (B.sd**2/B.n)**2/(B.n-1));
  const pVal = tails === 2 ? 2*(1-normCDF(Math.abs(t))) : 1-normCDF(t);
  const sig  = pVal < alpha;
  const liftPct = (B.mean - A.mean) / A.mean * 100;
  const sigBetter = sig && liftPct > 0;
  const sigWorse  = sig && liftPct < 0;
  const ci95 = 1.96 * se;
  const diags = varianceDiagnostics(A, B);

  let html = `<div class='ar-header'>${headerLabel}</div><div class='ar-body'>`;
  const verdictClassW = sigBetter ? 'sig' : sigWorse ? 'worse' : 'insig';
  const verdictTextW  = sigBetter ? T[currentLang].js_ship
                      : sigWorse  ? T[currentLang].js_variant_worse
                      : T[currentLang].js_no_winner;
  html += `<div class="ar-verdict ${verdictClassW}">${verdictTextW}</div>`;
  html += `<div class="ar-sub">p = ${pVal.toFixed(4)} · α = ${alpha} · ${tails===2?T[currentLang].js_two_sided:T[currentLang].js_one_sided}</div>`;
  html += `<div class="ar-stats">
    <div class="ar-stat"><strong>${fmtFn(A.mean)}</strong>${T[currentLang].js_control_avg}</div>
    <div class="ar-stat"><strong>${fmtFn(B.mean)}</strong>${T[currentLang].js_variant_avg}</div>
    <div class="ar-stat"><strong>${liftPct>0?'+':''}${liftPct.toFixed(1)}%</strong>${T[currentLang].js_rel_lift}</div>
    <div class="ar-stat"><strong>±${fmtFn(ci95)}</strong>${T[currentLang].js_margin}</div>
    <div class="ar-stat"><strong>${A.sd.toFixed(2)} / ${B.sd.toFixed(2)}</strong>${T[currentLang].js_ctrl_var}</div>
    <div class="ar-stat"><strong>${(A.sd/Math.abs(A.mean)).toFixed(2)} / ${(B.sd/Math.abs(B.mean)).toFixed(2)}</strong>${T[currentLang].js_cv_ctrl_var}</div>
  </div>`;

  html += renderDiagnostics(diags);

  html += `<div class="res-chart-grid">
    <div class="chart-card" style="margin-bottom:0">
      <div class="chart-title">Values with 95% confidence intervals</div>
      <div class="chart-sub">Bars are observed averages; whiskers are CIs. Non-overlapping intervals roughly imply a significant difference.</div>
      <div class="chart-wrap"><canvas id="${chartBarId}"></canvas></div>
    </div>
    <div class="chart-card" style="margin-bottom:0">
      <div class="chart-title">How your observed difference compares to the null distribution</div>
      <div class="chart-sub">Under H₀ the difference should sit near zero. The orange marker is what you observed — red areas are rejection zones at α = ${alpha}.</div>
      <div class="chart-wrap"><canvas id="${chartNullId}"></canvas></div>
    </div>
  </div>`;

  const ciAlo = (A.mean - 1.96*A.sd/Math.sqrt(A.n)).toFixed(4);
  const ciAhi = (A.mean + 1.96*A.sd/Math.sqrt(A.n)).toFixed(4);
  const ciBlo = (B.mean - 1.96*B.sd/Math.sqrt(B.n)).toFixed(4);
  const ciBhi = (B.mean + 1.96*B.sd/Math.sqrt(B.n)).toFixed(4);
  const pDisplay = pVal < 0.0001 ? '< 0.0001' : pVal.toFixed(4);
  html += `<div class="scroll-x" style="margin-top:16px">
    <table class="ref-table" style="min-width:500px">
      <thead><tr><th>Variant</th><th>n</th><th>Mean</th><th>SD</th><th>CV</th><th>95% CI</th><th>Δ vs A</th><th>P-value</th></tr></thead>
      <tbody>
        <tr>
          <td><span style="color:${RC.P};font-weight:700">◆ A</span></td>
          <td>${A.n.toLocaleString()}</td><td><strong>${fmtFn(A.mean)}</strong></td>
          <td>${A.sd.toFixed(3)}</td><td>${(A.sd/Math.abs(A.mean)).toFixed(2)}</td>
          <td>[${ciAlo}, ${ciAhi}]</td><td>—</td><td>—</td>
        </tr>
        <tr style="background:${sigBetter?'rgba(26,122,74,0.06)':sigWorse?'rgba(220,50,50,0.06)':'rgba(91,80,200,0.04)'}">
          <td><span style="color:${sigBetter?RC.GR:sigWorse?RC.RED:RC.P};font-weight:700">${sigBetter?'★':sigWorse?'▼':'◆'} B</span></td>
          <td>${B.n.toLocaleString()}</td><td><strong>${fmtFn(B.mean)}</strong></td>
          <td>${B.sd.toFixed(3)}</td><td>${(B.sd/Math.abs(B.mean)).toFixed(2)}</td>
          <td>[${ciBlo}, ${ciBhi}]</td>
          <td style="color:${sigBetter?RC.GR:sigWorse?RC.RED:RC.MUTED};font-weight:600">${liftPct>0?'+':''}${liftPct.toFixed(2)}%</td>
          <td style="color:${sigBetter?RC.GR:sigWorse?RC.RED:RC.MUTED};font-weight:600">${pDisplay}</td>
        </tr>
      </tbody>
    </table>
  </div>`;

  html += sigBetter
    ? `<div class="notice success" style="margin-top:12px"><strong>${T[currentLang].js_before_ship}</strong><ul style="margin-top:6px;padding-left:16px"><li>${T[currentLang].js_guardrails}</li><li>${T[currentLang].js_segments}</li></ul></div>`
    : `<div class="notice info" style="margin-top:12px"><strong>${T[currentLang].js_not_sig}</strong> ${T[currentLang].js_keep_running}</div>`;

  html += '</div>';
  const box = document.getElementById(resultBoxId);
  box.innerHTML = html; box.classList.remove('hidden');
  scrollToResultMobile(box);
  saveRecentResult({
    type: headerLabel,
    verdict: verdictTextW,
    status: sigBetter ? 'win' : sigWorse ? 'lose' : 'neutral',
    meta: `${fmtFn(B.mean)} vs ${fmtFn(A.mean)} · ${liftPct>0?'+':''}${liftPct.toFixed(1)}% · p=${pVal.toFixed(3)}`,
    inputs: [
      { k: T[currentLang].ri_control, v: `${T[currentLang].ri_mean} ${fmtFn(A.mean)}, SD ${A.sd.toFixed(2)}, n=${A.n.toLocaleString()}` },
      { k: T[currentLang].ri_variant, v: `${T[currentLang].ri_mean} ${fmtFn(B.mean)}, SD ${B.sd.toFixed(2)}, n=${B.n.toLocaleString()}` },
      { k: T[currentLang].ri_settings, v: `α=${alpha}, ${tails===2?T[currentLang].js_two_sided:T[currentLang].js_one_sided}` },
    ],
  });

  setTimeout(() => {
    const ciA = 1.96 * A.sd / Math.sqrt(A.n);
    const ciB = 1.96 * B.sd / Math.sqrt(B.n);
    drawBarsCI(chartBarId,
      [{label:'A', subLabel:'CONTROL', val:A.mean, ci:ciA, col:RC.P, colFill:RC.PL},
       {label:'B', subLabel:'', val:B.mean, ci:ciB, col:sig?RC.GR:RC.P, colFill:sig?RC.GRL:RC.PL}],
      fmtFn);
    drawNullDist(chartNullId, A.mean, B.mean, se, t, alpha, tails, sig, fmtFn);
  }, 20);
}

// ── Analyse continuous ──
function analyseContinuous() {
  const blocks = document.querySelectorAll('#cont-variants .cont-variant-block');
  if (blocks.length < 2) { showInlineError('cont-result', T[currentLang].js_err_need_two); return; }
  const A = parseBlock(blocks[0]);
  const B = parseBlock(blocks[1]);
  if (!A||!B) { showInlineError('cont-result', T[currentLang].js_err_paste_values); return; }
  const alpha = parseFloat(document.querySelector('input[name="ac-alpha"]:checked').value);
  const tails = parseInt(document.querySelector('input[name="ac-tails"]:checked').value);
  runWelchT(A, B, alpha, tails, 'cont-result', 'res-chart-cont-bars', 'res-chart-cont-lift',
    "Results — Continuous metric (Welch's t-test)", v => v.toFixed(2));
}

// ── Analyse ratio ──
function analyseRatio() {
  const blocks = document.querySelectorAll('#ratio-variants .cont-variant-block');
  if (blocks.length < 2) { showInlineError('ratio-result', T[currentLang].js_err_need_two); return; }
  const A = parseBlock(blocks[0]);
  const B = parseBlock(blocks[1]);
  if (!A||!B) { showInlineError('ratio-result', T[currentLang].js_err_paste_ratio); return; }
  const alpha = parseFloat(document.querySelector('input[name="ar-alpha"]:checked').value);
  const tails = parseInt(document.querySelector('input[name="ar-tails"]:checked').value);
  runWelchT(A, B, alpha, tails, 'ratio-result', 'res-chart-ratio-bars', 'res-chart-ratio-lift',
    "Results — Ratio metric (Welch's t on aggregated per-user values)", v => v.toFixed(3));
}

// ── Result charts ────────────────────────────────────
function resCanvas(id) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;
  const wrap = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const W = wrap.clientWidth, H = wrap.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  return { ctx, W, H };
}
let RC = {
  P: '#5b50c8', PL: 'rgba(91,80,200,0.18)',
  OR: '#e8832a', ORL: 'rgba(232,131,42,0.18)',
  GR: '#1a7a4a', GRL: 'rgba(26,122,74,0.15)',
  RED: '#dc3232', REDL: 'rgba(220,50,50,0.15)',
  MUTED: '#9a9cb8', INK: '#1a1a2e', BG: '#ffffff',
  BORDER: '#e2e4ef'
};

// ── Download a chart canvas as a PNG (with solid background + padding) ──
// Copy the code inside a .code-block to the clipboard, with button feedback.
function copyCodeBlock(btn) {
  const block = btn.closest('.code-block');
  const pre = block && block.querySelector('pre');
  if (!pre) return;
  const text = pre.innerText;
  const done = () => {
    const orig = btn.getAttribute('data-label') || btn.textContent;
    if (!btn.getAttribute('data-label')) btn.setAttribute('data-label', orig);
    btn.textContent = (T[currentLang] && T[currentLang].btn_copied) || 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = (T[currentLang] && T[currentLang].btn_copy) || btn.getAttribute('data-label') || 'Copy';
      btn.classList.remove('copied');
    }, 1600);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch (e) {}
  document.body.removeChild(ta);
}

function downloadChart(canvasId, filename) {
  const src = document.getElementById(canvasId);
  if (!src) return;
  const pad = 24;
  const out = document.createElement('canvas');
  out.width = src.width + pad * 2;
  out.height = src.height + pad * 2;
  const ctx = out.getContext('2d');
  // solid background matching the current theme card colour
  ctx.fillStyle = RC.BG || '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(src, pad, pad);
  // small watermark
  ctx.fillStyle = RC.MUTED || '#9a9cb8';
  ctx.font = '12px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('A/B Testing Calculator', out.width - pad, out.height - 8);
  out.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (filename || 'chart') + '.png';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

// ── Case-study mini distribution charts ──
function drawCaseStudyCharts() {
  const dpr = window.devicePixelRatio || 1;
  function csInit(id) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    const wrap = canvas.parentElement;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    if (!W || !H) return null;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    return { ctx, W, H };
  }
  function grad(ctx, hex, topY, botY) {
    const g = ctx.createLinearGradient(0, topY, 0, botY);
    const h = hex.replace('#',''); const n = parseInt(h, 16);
    const rgb = `${(n>>16)&255},${(n>>8)&255},${n&255}`;
    g.addColorStop(0, `rgba(${rgb},0.34)`);
    g.addColorStop(1, `rgba(${rgb},0.03)`);
    return g;
  }
  function curve(ctx, W, H, f, hex, opts) {
    opts = opts || {};
    const pad = { t: 14, b: 16, l: 12, r: 12 };
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const N = 90; const ys = []; let maxY = 0;
    for (let j=0;j<=N;j++){ const y=Math.max(0,f(j/N)); ys.push(y); if(y>maxY)maxY=y; }
    const toX = j => pad.l + (j/N)*pw;
    const toY = y => pad.t + ph - (y/maxY)*ph*0.9;
    ctx.beginPath(); ctx.moveTo(toX(0), pad.t+ph);
    ys.forEach((y,j)=>ctx.lineTo(toX(j),toY(y)));
    ctx.lineTo(toX(N), pad.t+ph); ctx.closePath();
    ctx.fillStyle = grad(ctx, hex, pad.t, pad.t+ph); ctx.fill();
    ctx.beginPath();
    ys.forEach((y,j)=>j===0?ctx.moveTo(toX(j),toY(y)):ctx.lineTo(toX(j),toY(y)));
    ctx.strokeStyle = hex; ctx.lineWidth = 2.4; ctx.stroke();
    // baseline
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t+ph); ctx.lineTo(pad.l+pw, pad.t+ph);
    ctx.strokeStyle = RC.BORDER; ctx.lineWidth = 1; ctx.stroke();
    // optional vertical markers at given t positions: [{t, color, label}]
    (opts.markers || []).forEach(m => {
      const x = toX(m.t * N);
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t+ph);
      ctx.strokeStyle = m.color; ctx.lineWidth = 1.5; ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = m.color; ctx.font = '600 9.5px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(m.label, x, pad.t + 9);
    });
  }
  function bars(ctx, W, H, vals, hex) {
    const pad = { t: 14, b: 16, l: 12, r: 12 };
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const m = vals.length; const maxY = Math.max(...vals);
    const gap = pw/m*0.22; const bw = (pw - gap*(m+1))/m;
    const g = grad(ctx, hex, pad.t, pad.t+ph);
    vals.forEach((v,j)=>{
      const x = pad.l + gap + j*(bw+gap);
      const h = (v/maxY)*ph*0.9; const y = pad.t+ph-h;
      ctx.fillStyle = g; ctx.strokeStyle = hex; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.roundRect(x, y, bw, h, Math.min(3,bw/2)); ctx.fill(); ctx.stroke();
    });
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t+ph); ctx.lineTo(pad.l+pw, pad.t+ph);
    ctx.strokeStyle = RC.BORDER; ctx.lineWidth = 1; ctx.stroke();
  }

  // Case 1: binary proportion — two bars (did not convert vs converted)
  (function(){ const c = csInit('cs-chart-1'); if(!c) return;
    bars(c.ctx, c.W, c.H, [97, 3], RC.P);
    c.ctx.fillStyle = RC.MUTED; c.ctx.font = '600 9.5px Inter, sans-serif'; c.ctx.textAlign='center';
    const pad=12, pw=c.W-pad*2, bw=(pw-(pw/2*0.22)*3)/2, gap=pw/2*0.22;
    c.ctx.fillText('0 (no)', pad+gap+bw/2, c.H-4);
    c.ctx.fillText('1 (yes)', pad+gap*2+bw+bw/2, c.H-4);
  })();
  // Case 2: extreme right-skew with a far outlier — mean ≫ median
  (function(){ const c = csInit('cs-chart-2'); if(!c) return;
    curve(c.ctx, c.W, c.H, t => { const x=t*5; return (x*Math.exp(-x))/0.37 + 0.04/(1+Math.pow((t-0.86)/0.05,2)); }, RC.OR,
      { markers: [ {t:0.16, color:RC.GR, label:'median'}, {t:0.40, color:RC.RED, label:'mean'} ] });
  })();
  // Case 3: bimodal — two humps with the misleading mean in the empty valley
  (function(){ const c = csInit('cs-chart-3'); if(!c) return;
    curve(c.ctx, c.W, c.H, t => Math.exp(-Math.pow((t-0.22)/0.10,2)/2) + 0.9*Math.exp(-Math.pow((t-0.78)/0.10,2)/2), RC.P,
      { markers: [ {t:0.5, color:RC.RED, label:'mean'} ] });
  })();
}

// ── Distribution anatomy charts (mean/median/mode + SD rule) ──
function drawAnatomyCharts() {
  const dpr = window.devicePixelRatio || 1;
  function aInit(id) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    const wrap = canvas.parentElement;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    if (!W || !H) return null;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    return { ctx, W, H };
  }
  function grad(ctx, hex, topY, botY, ta, ba) {
    const g = ctx.createLinearGradient(0, topY, 0, botY);
    const h = hex.replace('#',''); const n = parseInt(h, 16);
    const rgb = `${(n>>16)&255},${(n>>8)&255},${n&255}`;
    g.addColorStop(0, `rgba(${rgb},${ta})`); g.addColorStop(1, `rgba(${rgb},${ba})`);
    return g;
  }
  const L = T[currentLang];

  // Normal with per-segment shares (68-95-99.7), styled like the classic reference figure
  (function(){ const c = aInit('anat-chart-normal'); if(!c) return;
    const { ctx, W, H } = c;
    const pad = { t: 30, b: 34, l: 16, r: 16 };
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const mu = pad.l + pw/2;
    const sd = pw / 8.0;                       // px per 1 SD (±4 SD visible)
    const f = x => Math.exp(-0.5 * Math.pow((x-mu)/sd, 2));
    const toY = v => pad.t + ph - v*ph*0.86;
    const hx = RC.P.replace('#',''); const rn = parseInt(hx,16);
    const R=(rn>>16)&255, G=(rn>>8)&255, B=rn&255;
    // Per-segment fills with increasing depth toward the centre (mirrors the reference image)
    // segments defined by [from*sd, to*sd] from the mean, with a fill alpha and a % label
    const segs = [
      { a:0, b:1, alpha:0.55, pct:'34.1%' },
      { a:1, b:2, alpha:0.32, pct:'13.6%' },
      { a:2, b:3, alpha:0.16, pct:'2.1%' },
      { a:3, b:4, alpha:0.07, pct:'0.1%' },
    ];
    function fillSeg(x0, x1, alpha){
      ctx.beginPath(); ctx.moveTo(x0, toY(0));
      for (let x=x0; x<=x1; x+=1) ctx.lineTo(x, toY(f(x)));
      ctx.lineTo(x1, toY(0)); ctx.closePath();
      ctx.fillStyle = `rgba(${R},${G},${B},${alpha})`; ctx.fill();
    }
    // draw both sides of each segment
    segs.forEach(s => {
      fillSeg(mu + s.a*sd, mu + s.b*sd, s.alpha);     // right
      fillSeg(mu - s.b*sd, mu - s.a*sd, s.alpha);     // left
    });
    // σ gridlines
    ctx.textAlign = 'center';
    for (let k=-4; k<=4; k++){
      const x = mu + k*sd;
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, toY(0));
      ctx.strokeStyle = k===0 ? '#ffffff' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = k===0 ? 1.5 : 1;
      if (Math.abs(k)<=3) ctx.stroke();
      ctx.fillStyle = RC.MUTED; ctx.font = '600 9.5px Inter, sans-serif';
      if (Math.abs(k)<=3) ctx.fillText(k===0?'0':(k>0?`${k}σ`:`${k}σ`), x, H - 18);
    }
    // curve outline
    ctx.beginPath();
    for (let x=pad.l; x<=pad.l+pw; x+=1) (x===pad.l?ctx.moveTo(x,toY(f(x))):ctx.lineTo(x,toY(f(x))));
    ctx.strokeStyle = RC.P; ctx.lineWidth = 2.5; ctx.stroke();
    // baseline
    ctx.beginPath(); ctx.moveTo(pad.l, toY(0)); ctx.lineTo(pad.l+pw, toY(0));
    ctx.strokeStyle = RC.BORDER; ctx.lineWidth = 1; ctx.stroke();
    // segment % labels — centred in each segment, inside the curve where there is room
    ctx.font = '700 10px Inter, sans-serif';
    const lblY = [ toY(0.30), toY(0.30) ];   // 34.1% sits high inside the central band
    // 34.1% both sides
    ctx.fillStyle = '#fff';
    ctx.fillText('34.1%', mu - 0.5*sd, toY(0.34));
    ctx.fillText('34.1%', mu + 0.5*sd, toY(0.34));
    // 13.6% both sides (white on mid band)
    ctx.fillStyle = '#1c3d5a';
    ctx.fillText('13.6%', mu - 1.5*sd, toY(0.07));
    ctx.fillText('13.6%', mu + 1.5*sd, toY(0.07));
    // 2.1% and 0.1% sit above the curve with little leader text
    ctx.fillStyle = RC.MUTED; ctx.font = '600 9px Inter, sans-serif';
    ctx.fillText('2.1%', mu - 2.5*sd, toY(0.10));
    ctx.fillText('2.1%', mu + 2.5*sd, toY(0.10));
    ctx.fillText('0.1%', mu - 3.4*sd, toY(0.05));
    ctx.fillText('0.1%', mu + 3.4*sd, toY(0.05));
    // top summary brackets: 68% / 95% / 99.7%
    ctx.fillStyle = RC.INK; ctx.font = '700 9.5px Inter, sans-serif'; ctx.textAlign='center';
    ctx.fillText('68%', mu, pad.t - 18);
    ctx.fillStyle = RC.MUTED; ctx.font = '600 9px Inter, sans-serif';
    ctx.fillText('95% within ±2σ · 99.7% within ±3σ', mu, pad.t - 6);
    // mean=median=mode marker
    ctx.fillStyle = RC.GR; ctx.font = '700 9.5px Inter, sans-serif';
    ctx.fillText(L.anat_mmm || 'mean = median = mode', mu, H - 4);
  })();

  // Skewed helper: gamma-like shape, with mode/median/mean markers
  function drawSkew(id, mirror) {
    const c = aInit(id); if(!c) return;
    const { ctx, W, H } = c;
    const pad = { t: 18, b: 40, l: 16, r: 16 };
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    // gamma-ish density on t in [0,1]
    const dens = u => { const x = u*6; return x*x*Math.exp(-x); };
    const N = 160;
    const raw = [];
    let maxY = 0;
    for (let i=0;i<=N;i++){ const u=i/N; const y=dens(u); raw.push(y); if(y>maxY)maxY=y; }
    // compute mode/median/mean in u-space
    let modeU = 0, best=-1;
    raw.forEach((y,i)=>{ if(y>best){best=y;modeU=i/N;} });
    const total = raw.reduce((s,y)=>s+y,0);
    let cum=0, medianU=0;
    for (let i=0;i<=N;i++){ cum+=raw[i]; if(cum>=total/2){ medianU=i/N; break; } }
    let meanNum=0; raw.forEach((y,i)=>meanNum+=y*(i/N)); const meanU=meanNum/total;
    const tx = u => mirror ? (1-u) : u;
    const toX = u => pad.l + tx(u)*pw;
    const toY = y => pad.t + ph - (y/maxY)*ph*0.9;
    const hex = mirror ? RC.GR : RC.OR;
    // fill
    ctx.beginPath(); ctx.moveTo(toX(0), toY(0));
    for (let i=0;i<=N;i++) ctx.lineTo(toX(i/N), toY(raw[i]));
    ctx.lineTo(toX(1), toY(0)); ctx.closePath();
    ctx.fillStyle = grad(ctx, hex, pad.t, pad.t+ph, 0.30, 0.03); ctx.fill();
    // curve
    ctx.beginPath();
    for (let i=0;i<=N;i++) (i===0?ctx.moveTo(toX(0),toY(raw[0])):ctx.lineTo(toX(i/N),toY(raw[i])));
    ctx.strokeStyle = hex; ctx.lineWidth = 2.5; ctx.stroke();
    // baseline
    ctx.beginPath(); ctx.moveTo(pad.l, toY(0)); ctx.lineTo(pad.l+pw, toY(0));
    ctx.strokeStyle = RC.BORDER; ctx.lineWidth = 1; ctx.stroke();
    // markers — ordered by position so labels stagger cleanly
    const marks = [
      { u: modeU,  color: RC.P,  label: L.anat_mode   || 'mode' },
      { u: medianU,color: RC.GR2 || '#0d9488', label: L.anat_median || 'median' },
      { u: meanU,  color: RC.RED, label: L.anat_mean  || 'mean' },
    ].sort((a,b)=> tx(a.u) - tx(b.u)); // left-to-right on screen
    marks.forEach((m, idx) => {
      const x = toX(m.u);
      ctx.beginPath(); ctx.moveTo(x, pad.t+2); ctx.lineTo(x, toY(0));
      ctx.strokeStyle = m.color; ctx.lineWidth = 1.6; ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = m.color; ctx.font = '700 9.5px Inter, sans-serif';
      // stack labels top-to-bottom (each ~13px lower) and align away from the crowded centre
      const labelY = pad.t + 9 + idx*13;
      // nudge left-most label left, right-most right, so they don't sit on the lines
      ctx.textAlign = idx===0 ? 'end' : (idx===marks.length-1 ? 'start' : 'center');
      const dx = idx===0 ? -3 : (idx===marks.length-1 ? 3 : 0);
      ctx.fillText(m.label, x + dx, labelY);
    });
  }
  drawSkew('anat-chart-right', false);
  drawSkew('anat-chart-left', true);

  // Binomial: discrete bars, n=20 p=0.3, mean=np marker
  (function(){ const c = aInit('anat-chart-binom'); if(!c) return;
    const { ctx, W, H } = c;
    const pad = { t: 18, b: 40, l: 16, r: 16 };
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const n = 20, p = 0.3;
    // binomial pmf
    function choose(n,k){ let r=1; for(let i=0;i<k;i++) r=r*(n-i)/(i+1); return r; }
    const pmf = [];
    let maxY = 0;
    for (let k=0;k<=n;k++){ const v = choose(n,k)*Math.pow(p,k)*Math.pow(1-p,n-k); pmf.push(v); if(v>maxY)maxY=v; }
    const m = n+1;
    const gap = pw/m*0.22; const bw = (pw - gap*(m+1))/m;
    const toY = v => pad.t + ph - (v/maxY)*ph*0.9;
    const g = grad(ctx, RC.P, pad.t, pad.t+ph, 0.5, 0.12);
    for (let k=0;k<=n;k++){
      const x = pad.l + gap + k*(bw+gap);
      const h = (pmf[k]/maxY)*ph*0.9; const y = pad.t+ph-h;
      ctx.fillStyle = g; ctx.strokeStyle = RC.P; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(x, y, bw, h, Math.min(2.5,bw/2)); ctx.fill(); ctx.stroke();
    }
    // baseline
    ctx.beginPath(); ctx.moveTo(pad.l, toY(0)); ctx.lineTo(pad.l+pw, toY(0));
    ctx.strokeStyle = RC.MUTED; ctx.lineWidth = 1; ctx.stroke();
    // mean = n*p marker
    const meanK = n*p;
    const xMean = pad.l + gap + meanK*(bw+gap) + bw/2;
    ctx.beginPath(); ctx.moveTo(xMean, pad.t+6); ctx.lineTo(xMean, toY(0));
    ctx.strokeStyle = RC.RED; ctx.lineWidth = 1.6; ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = RC.RED; ctx.font = '700 9.5px Inter, sans-serif'; ctx.textAlign='center';
    ctx.fillText((L.anat_binom_mean || 'mean = n·p = 6'), xMean, pad.t + 4);
    // x ticks
    ctx.fillStyle = RC.MUTED; ctx.font = '600 9px Inter, sans-serif';
    [0,5,10,15,20].forEach(k=>{ const x=pad.l+gap+k*(bw+gap)+bw/2; ctx.fillText(k, x, H-24); });
    ctx.fillText(L.anat_binom_x || 'number of successes (k)', pad.l+pw/2, H-8);
  })();
}


// Bar chart with CI whiskers — conversion rates or means
function drawBarCI(canvasId, labels, values, cis, colors, yLabel) {
  const c = resCanvas(canvasId); if (!c) return;
  const { ctx, W, H } = c;
  const pad = { t: 16, b: 36, l: 8, r: 8 };
  const n = labels.length;
  const barW = Math.min(60, (W - pad.l - pad.r) / n * 0.5);
  const gap   = (W - pad.l - pad.r - barW * n) / (n + 1);
  const yMax  = Math.max(...values.map((v,i) => v + cis[i])) * 1.25;
  const ch    = H - pad.t - pad.b;

  function toY(v) { return pad.t + ch - (v / yMax) * ch; }
  function barX(i) { return pad.l + gap * (i + 1) + barW * i; }

  // y gridlines (3)
  [0.33, 0.66, 1].forEach(f => {
    const y = toY(yMax * f);
    ctx.beginPath(); ctx.setLineDash([2, 4]);
    ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y);
    ctx.strokeStyle = RC.BORDER; ctx.lineWidth = 1; ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '10px Inter,system-ui,sans-serif';
    ctx.fillStyle = RC.MUTED; ctx.textAlign = 'right';
    const val = yMax * f;
    ctx.fillText(val < 1 ? (val*100).toFixed(1)+'%' : val.toFixed(1), pad.l + 36, y + 3);
  });

  values.forEach((v, i) => {
    const x = barX(i);
    const yTop = toY(v);
    const yBase = toY(0);

    // bar
    ctx.beginPath();
    ctx.roundRect(x, yTop, barW, yBase - yTop, 4);
    ctx.fillStyle = colors[i];
    ctx.fill();

    // CI whisker
    const ciPx = (cis[i] / yMax) * ch;
    const mid = x + barW / 2;
    ctx.beginPath();
    ctx.moveTo(mid, yTop - ciPx);
    ctx.lineTo(mid, yTop + ciPx);
    ctx.strokeStyle = i === 0 ? 'rgba(91,80,200,0.6)' : 'rgba(232,131,42,0.8)';
    ctx.lineWidth = 2; ctx.stroke();
    // caps
    [yTop - ciPx, yTop + ciPx].forEach(y => {
      ctx.beginPath(); ctx.moveTo(mid - 5, y); ctx.lineTo(mid + 5, y);
      ctx.stroke();
    });

    // value label above bar
    ctx.font = 'bold 11px Inter,system-ui,sans-serif';
    ctx.fillStyle = RC.INK; ctx.textAlign = 'center';
    ctx.fillText(v < 1 ? (v*100).toFixed(2)+'%' : v.toFixed(2), mid, yTop - ciPx - 5);

    // x label
    ctx.font = '11px Inter,system-ui,sans-serif';
    ctx.fillStyle = RC.MUTED; ctx.textAlign = 'center';
    ctx.fillText(labels[i], mid, H - 6);
  });
}

// Lift meter: horizontal bar from 0, CI range shaded, confidence arc
function drawLiftMeter(canvasId, liftPct, ciPct, sig, pVal, alpha) {
  const c = resCanvas(canvasId); if (!c) return;
  const { ctx, W, H } = c;

  // ── Confidence arc (top half) ──
  const confidence = Math.min((1 - pVal) * 100, 99.99);
  const cx = W / 2, cy = H * 0.44, r = Math.min(W * 0.3, H * 0.38);

  // background track
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.strokeStyle = RC.BG; ctx.lineWidth = 12; ctx.stroke();

  // filled arc
  const endAngle = Math.PI + (confidence / 100) * Math.PI;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, endAngle);
  ctx.strokeStyle = sig ? RC.GR : RC.MUTED;
  ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.stroke();

  // needle
  const needleAngle = Math.PI + (confidence / 100) * Math.PI;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(needleAngle) * (r - 4), cy + Math.sin(needleAngle) * (r - 4));
  ctx.strokeStyle = RC.INK; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();

  // centre dot
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI*2);
  ctx.fillStyle = RC.INK; ctx.fill();

  // confidence %
  ctx.font = 'bold 18px Inter,system-ui,sans-serif';
  ctx.fillStyle = sig ? RC.GR : RC.MUTED;
  ctx.textAlign = 'center';
  ctx.fillText(confidence.toFixed(1) + '%', cx, cy - 4);

  ctx.font = '10px Inter,system-ui,sans-serif';
  ctx.fillStyle = RC.MUTED;
  ctx.fillText('confidence', cx, cy + 12);

  // ── Lift label below ──
  const liftStr = (liftPct > 0 ? '+' : '') + liftPct.toFixed(1) + '%';
  const ciStr   = '±' + ciPct.toFixed(1) + '%';
  ctx.font = 'bold 13px Inter,system-ui,sans-serif';
  ctx.fillStyle = liftPct > 0 ? RC.GR : liftPct < 0 ? RC.RED : RC.MUTED;
  ctx.fillText(liftStr + ' lift', cx, H - 22);
  ctx.font = '10px Inter,system-ui,sans-serif';
  ctx.fillStyle = RC.MUTED;
  ctx.fillText(ciStr + ' margin of error', cx, H - 8);
}

// Multi-variant horizontal bar chart
function drawMultiConvChart(variants) {
  const c = resCanvas('res-chart-multi-bars'); if (!c) return;
  const { ctx, W, H } = c;
  const pad = { t: 12, b: 12, l: 36, r: 60 };
  const ch = H - pad.t - pad.b;
  const barH = Math.min(24, ch / variants.length * 0.6);
  const gap  = (ch - barH * variants.length) / (variants.length + 1);
  const maxP = Math.max(...variants.map(v => v.p)) * 1.2;
  const cw   = W - pad.l - pad.r;
  const colors = [RC.PL.replace('0.18','0.7'), RC.ORL.replace('0.18','0.7'),
                  'rgba(26,122,74,0.7)', 'rgba(220,50,50,0.6)'];
  const strokes= [RC.P, RC.OR, RC.GR, RC.RED];

  function toX(p) { return pad.l + (p / maxP) * cw; }

  variants.forEach((v, i) => {
    const y = pad.t + gap * (i + 1) + barH * i;
    const tag = String.fromCharCode(65 + i);
    const ci = 1.96 * Math.sqrt(v.p*(1-v.p)/v.n);

    // bar
    ctx.beginPath();
    ctx.roundRect(pad.l, y, (v.p / maxP) * cw, barH, 3);
    ctx.fillStyle = i === 0 ? RC.PL.replace('0.18','0.65') : colors[i] || 'rgba(91,80,200,0.4)';
    ctx.fill();
    ctx.strokeStyle = strokes[i] || RC.P; ctx.lineWidth = 1.5; ctx.stroke();

    // CI whisker
    const ciX = (ci / maxP) * cw;
    const mid = y + barH / 2;
    const barEnd = toX(v.p);
    ctx.beginPath();
    ctx.moveTo(barEnd - ciX, mid); ctx.lineTo(barEnd + ciX, mid);
    ctx.strokeStyle = 'rgba(100,100,120,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    [barEnd - ciX, barEnd + ciX].forEach(x => {
      ctx.beginPath(); ctx.moveTo(x, mid-4); ctx.lineTo(x, mid+4); ctx.stroke();
    });

    // label
    ctx.font = '11px Inter,system-ui,sans-serif';
    ctx.fillStyle = RC.MUTED; ctx.textAlign = 'right';
    ctx.fillText(tag, pad.l - 4, mid + 4);

    // value
    ctx.font = 'bold 11px Inter,system-ui,sans-serif';
    ctx.fillStyle = RC.INK; ctx.textAlign = 'left';
    ctx.fillText((v.p*100).toFixed(2)+'%', toX(v.p) + ciX + 4, mid + 4);
  });
}

function drawConvCharts(A, B, se, z, pVal, sig, alpha, tails) {
  const ciA = 1.96 * Math.sqrt(A.p*(1-A.p)/A.n);
  const ciB = 1.96 * Math.sqrt(B.p*(1-B.p)/B.n);
  drawBarsCI('res-chart-conv-bars',
    [{label:'A', subLabel:'CONTROL', val:A.p, ci:ciA, col:RC.P, colFill:RC.PL},
     {label:'B', subLabel:'', val:B.p, ci:ciB, col:sig?RC.GR:RC.P, colFill:sig?RC.GRL:RC.PL}],
    v => (v*100).toFixed(2)+'%');
  drawNullDist('res-chart-conv-lift', A.p, B.p, se, z, alpha, tails, sig,
    v => (v*100).toFixed(2)+'%');
}

function drawContCharts(A, B, se, t, pVal, sig, alpha, ci95, liftPct) {
  const ciA = 1.96 * A.sd / Math.sqrt(A.n);
  const ciB = 1.96 * B.sd / Math.sqrt(B.n);
  drawBarsCI('res-chart-cont-bars',
    [{label:'A', subLabel:'CONTROL', val:A.mean, ci:ciA, col:RC.P, colFill:'rgba(91,80,200,0.25)'},
     {label:'B', subLabel:'', val:B.mean, ci:ciB, col:sig?RC.GR:RC.P, colFill:sig?'rgba(26,122,74,0.3)':'rgba(91,80,200,0.55)'}],
    v => v.toFixed(2));
  drawNullDist('res-chart-cont-lift', A.mean, B.mean, se, t, alpha, tails, sig,
    v => v.toFixed(3));
}

// Chart 1: Vertical bars with CI whiskers, zoomed y-axis
function drawBarsCI(canvasId, bars, fmt) {
  const c = resCanvas(canvasId); if (!c) return;
  const { ctx, W, H } = c;

  // Adaptive left padding: wider canvas gets more room for y-labels
  const lpad = W > 300 ? 46 : 38;
  const pad = { t: 28, b: 42, l: lpad, r: 10 };
  const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
  const n = bars.length;
  const barW = Math.min(80, cw / n * 0.5);
  const spacing = cw / n;

  // y range: zoom into data with margin
  const allWithCI = bars.flatMap(b => [b.val - b.ci, b.val + b.ci]);
  const dataMin = Math.min(...allWithCI);
  const dataMax = Math.max(...allWithCI);
  const range = dataMax - dataMin || dataMax * 0.1;
  const yMin = Math.max(0, dataMin - range * 0.5);
  const yMax = dataMax + range * 0.45;

  function toY(v) { return pad.t + ch - ((v - yMin) / (yMax - yMin)) * ch; }
  function barLeft(i) { return pad.l + spacing * i + (spacing - barW) / 2; }

  // Gridlines + y labels (right-aligned, drawn into pad.l space)
  const nGrids = 3;
  for (let g = 0; g <= nGrids; g++) {
    const v = yMin + (yMax - yMin) * g / nGrids;
    const y = toY(v);
    ctx.beginPath(); ctx.setLineDash([2, 4]);
    ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y);
    ctx.strokeStyle = RC.BORDER; ctx.lineWidth = 1; ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '9px Inter,system-ui,sans-serif';
    ctx.fillStyle = RC.MUTED; ctx.textAlign = 'right';
    ctx.fillText(fmt(v), pad.l - 3, y + 3);
  }

  // Baseline
  ctx.beginPath();
  ctx.moveTo(pad.l, toY(yMin)); ctx.lineTo(W - pad.r, toY(yMin));
  ctx.strokeStyle = RC.BORDER; ctx.lineWidth = 1; ctx.stroke();

  bars.forEach((b, i) => {
    const x = barLeft(i);
    const yTop = toY(b.val);
    const yBase = toY(yMin);
    const mid = x + barW / 2;

    // Bar
    ctx.beginPath();
    ctx.roundRect(x, yTop, barW, yBase - yTop, 4);
    ctx.fillStyle = b.colFill; ctx.fill();
    ctx.strokeStyle = b.col; ctx.lineWidth = 1.5; ctx.stroke();

    // CI whisker
    const ciPx = (b.ci / (yMax - yMin)) * ch;
    ctx.beginPath();
    ctx.moveTo(mid, yTop - ciPx); ctx.lineTo(mid, yTop + ciPx);
    ctx.strokeStyle = 'rgba(60,60,80,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
    [yTop - ciPx, yTop + ciPx].forEach(y => {
      ctx.beginPath(); ctx.moveTo(mid - 5, y); ctx.lineTo(mid + 5, y);
      ctx.strokeStyle = 'rgba(60,60,80,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
    });

    // Value label above whisker
    ctx.font = 'bold 10px Inter,system-ui,sans-serif';
    ctx.fillStyle = RC.INK; ctx.textAlign = 'center';
    ctx.fillText(fmt(b.val), mid, yTop - ciPx - 5);

    // Variant letter
    ctx.font = 'bold 11px Inter,system-ui,sans-serif';
    ctx.fillStyle = b.col; ctx.textAlign = 'center';
    ctx.fillText(b.label, mid, H - 24);

    // Sub-label (CONTROL)
    if (b.subLabel) {
      ctx.font = 'bold 8px Inter,system-ui,sans-serif';
      ctx.fillStyle = 'rgba(91,80,200,0.7)';
      ctx.fillText(b.subLabel, mid, H - 13);
    }
  });
}

// Chart 2: Null distribution of differences + observed marker
function drawNullDist(canvasId, muA, muB, se, stat, alpha, tails, sig, fmt) {
  const c = resCanvas(canvasId); if (!c) return;
  const { ctx, W, H } = c;

  const diff = muB - muA;           // observed difference
  const zCrit = normInvCDF(tails === 1 ? 1 - alpha : 1 - alpha / 2);
  const pad = { t: 36, b: 40, l: 12, r: 12 };
  const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;

  // x range: centre on 0 (null), show ±4 SE, always include the observed diff
  const halfRange = Math.max(zCrit * se * 1.6, Math.abs(diff) * 1.25);
  const xMin = -halfRange, xMax = halfRange;
  const yMax = normPDF(0, 0, se) * 1.2;

  function toX(v) { return pad.l + (v - xMin) / (xMax - xMin) * cw; }
  function toY(y) { return pad.t + ch - (y / yMax) * ch; }

  // Rejection fills
  const critL = -zCrit * se, critR = zCrit * se;

  function fillTail(from, to) {
    ctx.beginPath();
    ctx.moveTo(toX(from), toY(0));
    const step = (to - from) / 60;
    for (let x = from; x <= to; x += step)
      ctx.lineTo(toX(x), toY(normPDF(x, 0, se)));
    ctx.lineTo(toX(to), toY(0)); ctx.closePath();
    ctx.fillStyle = 'rgba(220,50,50,0.18)'; ctx.fill();
  }
  fillTail(xMin, critL);
  fillTail(critR, xMax);

  // Main bell fill
  ctx.beginPath();
  ctx.moveTo(toX(xMin), toY(0));
  for (let x = xMin; x <= xMax; x += (xMax-xMin)/300)
    ctx.lineTo(toX(x), toY(normPDF(x, 0, se)));
  ctx.lineTo(toX(xMax), toY(0)); ctx.closePath();
  ctx.fillStyle = 'rgba(91,80,200,0.1)'; ctx.fill();

  // Bell curve
  ctx.beginPath();
  for (let x = xMin; x <= xMax; x += (xMax-xMin)/300) {
    const px = toX(x), py = toY(normPDF(x, 0, se));
    x === xMin ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.strokeStyle = RC.P; ctx.lineWidth = 2; ctx.stroke();

  // Critical lines
  [critL, critR].forEach((cx, i) => {
    ctx.beginPath(); ctx.setLineDash([4, 4]);
    ctx.moveTo(toX(cx), toY(0));
    ctx.lineTo(toX(cx), toY(normPDF(cx, 0, se) * 0.9));
    ctx.strokeStyle = RC.MUTED; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '9px Inter,system-ui,sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = RC.MUTED;
    const lbl = i === 0 ? `−${zCrit.toFixed(2)} SE` : `+${zCrit.toFixed(2)} SE (critical)`;
    ctx.fillText(lbl, toX(cx), pad.t - 20);
  });

  // Baseline
  ctx.beginPath();
  ctx.moveTo(pad.l, toY(0)); ctx.lineTo(W - pad.r, toY(0));
  ctx.strokeStyle = RC.BORDER; ctx.lineWidth = 1; ctx.stroke();

  // Observed marker line
  const obsX = toX(diff);
  const obsCol = sig ? RC.OR : RC.MUTED;
  ctx.beginPath();
  ctx.moveTo(obsX, toY(0));
  ctx.lineTo(obsX, pad.t + 4);
  ctx.strokeStyle = obsCol; ctx.lineWidth = 2.5; ctx.stroke();

  // Observed dot on baseline
  ctx.beginPath(); ctx.arc(obsX, toY(0), 4, 0, Math.PI*2);
  ctx.fillStyle = obsCol; ctx.fill();

  // Observed label — clamped within canvas bounds
  ctx.font = 'bold 9px Inter,system-ui,sans-serif';
  ctx.fillStyle = obsCol;
  const obsLabel = `Observed: ${fmt(diff)}`;
  const obsLabelW = ctx.measureText(obsLabel).width;
  let obsLabelX, obsAlign;
  if (obsX + 6 + obsLabelW > W - pad.r) {
    obsLabelX = obsX - 6; obsAlign = 'right';
  } else {
    obsLabelX = obsX + 6; obsAlign = 'left';
  }
  ctx.textAlign = obsAlign;
  ctx.fillText(obsLabel, obsLabelX, pad.t + 14);

  // X-axis tick labels — show fewer on narrow canvases
  ctx.font = '8px Inter,system-ui,sans-serif'; ctx.fillStyle = RC.MUTED; ctx.textAlign = 'center';
  const narrow = W < 280;
  const ticks = narrow ? [xMin, 0, xMax] : [xMin, critL, 0, critR, xMax];
  const tickLabels = narrow
    ? [fmt(xMin), `${fmt(0)}`, fmt(xMax)]
    : [fmt(xMin), fmt(critL), `${fmt(0)} (no diff)`, fmt(critR), fmt(xMax)];
  ticks.forEach((v, i) => {
    const tx = toX(v);
    if (tx > pad.l + 4 && tx < W - pad.r - 4)
      ctx.fillText(tickLabels[i], tx, H - 5);
  });
}


// ═══════════════════════════════════════════════════════════════════════
// FILE UPLOAD — Excel / CSV
// Accepts BOTH raw per-user rows (one row = one user) and pre-aggregated
// counts, auto-detects column names (EN + RU synonyms), aggregates, fills
// the form, and shows a summary so the user can verify before analysing.
// ═══════════════════════════════════════════════════════════════════════

const UP_SYN = {
  group:     ['group','variant','arm','bucket','cohort','test_group','testgroup','гру\u043fпа','группа','вариант','когорта'],
  converted: ['converted','conversion','convert','success','is_converted','converts','purchased','конверсия','конверсии','целевое'],
  value:     ['value','metric','revenue','amount','val','score','spend','arpu','значение','выручка','сумма','метрика'],
  exposed:   ['exposed','users','n','count','sample','sample_size','visitors','impressions','показы','пользователи','выборка']
};

function upNorm(h) { return String(h == null ? '' : h).trim().toLowerCase().replace(/[\s\-.]+/g, '_'); }

function upFindCol(headers, kind) {
  const syn = UP_SYN[kind];
  for (let i = 0; i < headers.length; i++) {
    if (syn.includes(upNorm(headers[i]))) return i;
  }
  return -1;
}

function upStatus(metric, cls, html) {
  // element ids use the short form: conv / cont / ratio
  const short = metric === 'conversion' ? 'conv' : (metric === 'continuous' ? 'cont' : metric);
  const el = document.getElementById(short + '-upload-status');
  if (!el) return;
  el.className = 'upload-status ' + cls;
  el.innerHTML = html;
}

function handleExcelDrop(ev, metric) {
  ev.preventDefault();
  const short = metric === 'conversion' ? 'conv' : (metric === 'continuous' ? 'cont' : metric);
  const zone = document.getElementById(short + '-upload-zone');
  if (zone) zone.classList.remove('drag-over');
  const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
  if (f) handleExcelFile(f, metric);
}

function handleExcelFile(file, metric) {
  const L = T[currentLang] || {};
  if (!file) return;
  if (typeof XLSX === 'undefined') {
    upStatus(metric, 'up-err', L.up_err_lib || 'Spreadsheet library not loaded — check your connection and reload.');
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => upStatus(metric, 'up-err', L.up_err_read || 'Could not read the file.');
  reader.onload = e => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
      parseUploadedData(rows, metric);
    } catch (err) {
      upStatus(metric, 'up-err', (L.up_err_parse || 'Could not parse the file: {e}').replace('{e}', err.message));
    }
  };
  reader.readAsArrayBuffer(file);
}

function parseUploadedData(rows, metric) {
  const L = T[currentLang] || {};
  if (!rows || rows.length < 2) {
    upStatus(metric, 'up-err', L.up_err_empty || 'The file looks empty. Expected a header row plus data rows.');
    return;
  }
  // Find the header row (first row where a group column is recognisable)
  let hIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (upFindCol(rows[i] || [], 'group') >= 0) { hIdx = i; break; }
  }
  if (hIdx < 0) {
    const found = (rows[0] || []).join(', ');
    upStatus(metric, 'up-err',
      (L.up_err_nogroup || 'No group column found. Expected one of: group, variant, arm (or Russian equivalents). Found: {f}')
        .replace('{f}', found));
    return;
  }
  const headers = rows[hIdx];
  const gi = upFindCol(headers, 'group');
  const ci = upFindCol(headers, 'converted');
  const vi = upFindCol(headers, 'value');
  const ei = upFindCol(headers, 'exposed');
  const body = rows.slice(hIdx + 1).filter(r => r && r.length && r[gi] != null && String(r[gi]).trim() !== '');

  if (!body.length) {
    upStatus(metric, 'up-err', L.up_err_empty || 'The file looks empty. Expected a header row plus data rows.');
    return;
  }

  // ── Conversion ──────────────────────────────────────────────────────
  if (metric === 'conversion') {
    if (ci < 0 && ei < 0) {
      if (vi >= 0) {
        upStatus(metric, 'up-err', L.up_err_is_continuous ||
          'This looks like continuous data (found a "value" column, not "converted"). Switch to the Continuous metric tab and upload it there.');
        return;
      }
      upStatus(metric, 'up-err', L.up_err_noconv || 'No conversion column found. Expected "converted" with 0/1 per user, or pre-aggregated "exposed" + "converted".');
      return;
    }
    const agg = {};
    let badVal = 0;
    for (const r of body) {
      const g = String(r[gi]).trim();
      if (!agg[g]) agg[g] = { n: 0, c: 0 };
      if (ei >= 0) {                          // pre-aggregated rows
        agg[g].n += Number(r[ei]) || 0;
        agg[g].c += Number(r[ci]) || 0;
      } else {                                // raw per-user rows
        const raw = r[ci];
        const v = (raw === true || raw === 1 || raw === '1' || String(raw).trim().toLowerCase() === 'true') ? 1
                : (raw === false || raw === 0 || raw === '0' || String(raw).trim().toLowerCase() === 'false' || raw === '' || raw == null) ? 0
                : null;
        if (v === null) { badVal++; continue; }
        agg[g].n += 1; agg[g].c += v;
      }
    }
    const groups = Object.keys(agg);
    if (groups.length < 2) {
      upStatus(metric, 'up-err', (L.up_err_groups || 'Need exactly 2 groups, found {k}: {g}').replace('{k}', groups.length).replace('{g}', groups.join(', ')));
      return;
    }
    // control first: explicit "control"/"контроль", else alphabetical
    groups.sort((a, b) => {
      const ca = /^(control|контроль|a)$/i.test(a) ? -1 : 0;
      const cb = /^(control|контроль|a)$/i.test(b) ? -1 : 0;
      return ca !== cb ? ca - cb : String(a).localeCompare(String(b));
    });
    const use = groups.slice(0, 2);
    // fill the form
    const rowsEl = document.querySelectorAll('#conv-variants .variant-row');
    use.forEach((g, i) => {
      if (!rowsEl[i]) return;
      const un = rowsEl[i].querySelector('.cv-users');
      const cn = rowsEl[i].querySelector('.cv-conv');
      if (un) un.value = agg[g].n;
      if (cn) cn.value = agg[g].c;
    });
    let html = '<div class="up-ok-head">' + (L.up_ok || '✓ Loaded {n} rows').replace('{n}', body.length.toLocaleString()) + '</div>';
    html += '<table class="up-summary"><tr><th>' + (L.up_col_group || 'Group') + '</th><th>' + (L.up_col_n || 'Users') + '</th><th>' + (L.up_col_conv || 'Converted') + '</th><th>' + (L.up_col_rate || 'Rate') + '</th></tr>';
    use.forEach(g => {
      const a = agg[g];
      html += `<tr><td>${g}</td><td>${a.n.toLocaleString()}</td><td>${a.c.toLocaleString()}</td><td>${(a.c/a.n*100).toFixed(2)}%</td></tr>`;
    });
    html += '</table>';
    if (groups.length > 2) html += '<div class="up-warn">' + (L.up_warn_extra || '⚠ {k} groups found — used the first two: {g}').replace('{k}', groups.length).replace('{g}', use.join(', ')) + '</div>';
    if (badVal) html += '<div class="up-warn">' + (L.up_warn_badval || '⚠ {k} rows skipped: conversion must be 0 or 1.').replace('{k}', badVal) + '</div>';
    upStatus(metric, 'up-ok', html);
    return;
  }

  // ── Continuous / Ratio ──────────────────────────────────────────────
  if (vi < 0) {
    // The file may be perfectly valid — just loaded into the wrong tab.
    // If it carries conversion data, say so explicitly instead of a dead end.
    if (ci >= 0 || ei >= 0) {
      upStatus(metric, 'up-err', L.up_err_is_conversion ||
        'This looks like conversion data (found a "converted" column, not "value"). Switch to the Conversion tab and upload it there.');
      return;
    }
    upStatus(metric, 'up-err', L.up_err_novalue || 'No value column found. Expected "value" (or revenue / amount / значение) with one number per user.');
    return;
  }
  const vals = {};
  let skipped = 0, binaryOnly = true;
  for (const r of body) {
    const g = String(r[gi]).trim();
    const v = Number(r[vi]);
    if (!isFinite(v)) { skipped++; continue; }
    if (v !== 0 && v !== 1) binaryOnly = false;
    (vals[g] = vals[g] || []).push(v);
  }
  const groups = Object.keys(vals).filter(g => vals[g].length);
  if (groups.length < 2) {
    upStatus(metric, 'up-err', (L.up_err_groups || 'Need exactly 2 groups, found {k}: {g}').replace('{k}', groups.length).replace('{g}', groups.join(', ')));
    return;
  }
  groups.sort((a, b) => {
    const ca = /^(control|контроль|a)$/i.test(a) ? -1 : 0;
    const cb = /^(control|контроль|a)$/i.test(b) ? -1 : 0;
    return ca !== cb ? ca - cb : String(a).localeCompare(String(b));
  });
  const use = groups.slice(0, 2);
  const panelId = metric === 'ratio' ? '#analyse-section-ratio' : '#analyse-section-continuous';
  let tas = document.querySelectorAll(panelId + ' .cv-raw-ta');
  if (!tas.length) tas = document.querySelectorAll('.cv-raw-ta');   // fallback
  use.forEach((g, i) => {
    if (tas[i]) {
      tas[i].value = vals[g].join(', ');
      tas[i].dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  let html = '<div class="up-ok-head">' + (L.up_ok || '✓ Loaded {n} rows').replace('{n}', body.length.toLocaleString()) + '</div>';
  html += '<table class="up-summary"><tr><th>' + (L.up_col_group || 'Group') + '</th><th>' + (L.up_col_n || 'Users') + '</th><th>' + (L.up_col_mean || 'Mean') + '</th><th>' + (L.up_col_sd || 'SD') + '</th></tr>';
  use.forEach(g => {
    const a = vals[g];
    const m = a.reduce((s, x) => s + x, 0) / a.length;
    const sd = Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1 || 1));
    html += `<tr><td>${g}</td><td>${a.length.toLocaleString()}</td><td>${m.toFixed(2)}</td><td>${sd.toFixed(2)}</td></tr>`;
  });
  html += '</table>';
  if (binaryOnly) html += '<div class="up-warn">' + (L.up_warn_binary || '⚠ All values are 0/1 — this looks like a conversion metric. Switch to the Conversion tab for the correct test.') + '</div>';
  if (skipped) html += '<div class="up-warn">' + (L.up_warn_skipped || '⚠ {k} rows skipped (value was not a number).').replace('{k}', skipped) + '</div>';
  if (groups.length > 2) html += '<div class="up-warn">' + (L.up_warn_extra || '⚠ {k} groups found — used the first two: {g}').replace('{k}', groups.length).replace('{g}', use.join(', ')) + '</div>';
  upStatus(metric, 'up-ok', html);
}

/* ── Scroll-spy for the Learn tab's table of contents ──────────────────
   Highlights the section currently in view. Positions are measured from the
   document (getBoundingClientRect + scrollY) rather than offsetTop, because
   offsetTop is relative to the nearest positioned ancestor and gives the
   wrong section once the sidebar or a card becomes positioned. */
(function initTocSpy() {
  function setup() {
    const links = [...document.querySelectorAll('#tab-reference .toc-link')];
    if (!links.length) return;
    const sections = links
      .map(a => document.querySelector(a.getAttribute('href')))
      .map((el, i) => ({ el, i }))
      .filter(x => x.el);
    if (!sections.length) return;

    function spy() {
      const panel = document.getElementById('tab-reference');
      if (!panel || !panel.classList.contains('active')) return;
      const y = window.scrollY + 140;
      // The table of contents is ordered by topic, not by document order, so
      // pick the section whose top is closest above the viewport line rather
      // than the highest index — otherwise the wrong entry lights up.
      let active = -1, bestTop = -Infinity;
      sections.forEach(({ el, i }) => {
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (top <= y && top > bestTop) { bestTop = top; active = i; }
      });
      if (active === -1) active = 0;
      links.forEach((a, i) => a.classList.toggle('active', i === active));
    }
    window.addEventListener('scroll', spy, { passive: true });
    spy();

    links.forEach(a => a.addEventListener('click', e => {
      const t = document.querySelector(a.getAttribute('href'));
      if (!t) return;
      e.preventDefault();
      const top = t.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top, behavior: 'smooth' });
    }));
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else { setup(); }
})();

/* ── Inline code highlighting ──────────────────────────────────────────
   Keywords inside short <code> fragments in prose (if, else, for, with,
   None, WHERE, NULL…) get a distinct colour so they do not blend with the
   surrounding words. It runs after every language switch, because
   applyLang() replaces the text of translated elements and would wipe out
   highlighting baked into the page. Only <code> made purely of text is
   touched; code blocks (<pre>) have their own build-time highlighting. */
(function () {
  const PY_KW = new Set(['if','elif','else','for','while','break','continue','return','try','except',
    'finally','raise','with','yield','pass','assert','def','class','lambda','import','from','as',
    'global','nonlocal','del','and','or','not','in','is']);
  const PY_CONST = new Set(['True','False','None']);
  const SQL_KW = new Set(['SELECT','FROM','WHERE','GROUP','BY','ORDER','HAVING','LIMIT','JOIN','LEFT',
    'RIGHT','INNER','OUTER','FULL','CROSS','ON','AS','WITH','UNION','DISTINCT','OVER','PARTITION',
    'ROWS','BETWEEN','FILTER','CASE','WHEN','THEN','ELSE','END','AND','OR','NOT','IN','IS','EXISTS',
    'LIKE','ASC','DESC','INTERVAL']);
  const SQL_CONST = new Set(['NULL','TRUE','FALSE']);
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function paint(code) {
    if (code.closest('pre') || code.dataset.hl === '1') return;
    if ([...code.childNodes].some(n => n.nodeType !== 3)) return;   // only plain-text <code>
    const text = code.textContent;
    let changed = false;
    const html = text.split(/([A-Za-z_][A-Za-z0-9_]*)/).map((part, i) => {
      if (i % 2 === 0) return esc(part);                // separators
      if (PY_KW.has(part) || SQL_KW.has(part)) { changed = true; return '<span class="ik">' + part + '</span>'; }
      if (PY_CONST.has(part) || SQL_CONST.has(part)) { changed = true; return '<span class="ic">' + part + '</span>'; }
      return esc(part);
    }).join('');
    if (changed) { code.innerHTML = html; }
    code.dataset.hl = '1';
  }
  window.highlightInlineCode = function () {
    document.querySelectorAll('code').forEach(paint);
  };
  // re-run after every language switch
  if (typeof applyLang === 'function') {
    const original = applyLang;
    applyLang = function (lang) {
      original(lang);
      document.querySelectorAll('code[data-hl]').forEach(c => { delete c.dataset.hl; });
      window.highlightInlineCode();
    };
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.highlightInlineCode());
  } else { window.highlightInlineCode(); }
})();
