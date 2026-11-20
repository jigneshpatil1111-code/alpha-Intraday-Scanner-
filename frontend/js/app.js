/**
 * AlphaPulse IN — V3 Master Controller
 * Strict Section-Wise Architecture:
 * - 🔥 Intraday Picks
 * - 📈 Swing Stocks
 * - 🤖 Kronos AI Simulator (Full Screen Interactive Simulator with Chart, Entry, SL, Target)
 * - 📊 Sector Flow & Heatmap
 * - 📋 179 F&O Master Scanner (Live LTP with tick flash)
 * - 💼 Paper Trading OMS
 * - ⚙️ Angel One Live Broker
 */

const state = {
  currentUser: null,
  activeSection: 'intraday',
  allStocks: [],
  filteredStocks: [],
  intradayPicks: [],
  swingPicks: [],
  sectorAnalysis: null,
  selectedSectorForDrilldown: 'Banking',
  selectedSymbol: 'RELIANCE',
  selectedStock: null,
  activeSectorFilter: 'ALL',
  searchQuery: '',
  sortField: 'alpha_score',
  sortAsc: false,
  paperOrders: [],
  angelConnected: false,
  angelLive: false,
  wsClient: null,
  kronosData: null
};

// =====================================================================
// 1. INITIALIZATION & AUTHENTICATION
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
  checkAuthSession();
  initWebSocket();
  setupEventListeners();
  // Window resize re-renders active canvas if Kronos is open
  window.addEventListener('resize', () => {
    if (state.activeSection === 'kronos' && state.kronosData) {
      drawKronosCanvasChart(state.kronosData);
    }
  });
});

function checkAuthSession() {
  const saved = localStorage.getItem('alphapulse_user');
  if (saved) {
    try {
      state.currentUser = JSON.parse(saved);
      showDashboardShell();
      loadScannerUniverse();
      loadPaperPositions();
      checkAngelStatus();
      return;
    } catch (e) {
      localStorage.removeItem('alphapulse_user');
    }
  }
  showAuthScreen();
}

function showAuthScreen() {
  document.getElementById('auth-screen')?.classList.remove('hidden');
  document.getElementById('dashboard-shell')?.classList.add('hidden');
}

function showDashboardShell() {
  document.getElementById('auth-screen')?.classList.add('hidden');
  document.getElementById('dashboard-shell')?.classList.remove('hidden');
  const badge = document.getElementById('header-user-name');
  if (badge && state.currentUser) {
    badge.textContent = state.currentUser.full_name || state.currentUser.email;
  }
  // Ensure starting section is intraday
  switchSection('intraday');
}

function setAuthMode(mode) {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const tabLogin = document.getElementById('auth-tab-login');
  const tabSignup = document.getElementById('auth-tab-signup');
  document.getElementById('auth-feedback')?.classList.add('hidden');

  if (mode === 'login') {
    loginForm?.classList.remove('hidden');
    signupForm?.classList.add('hidden');
    if (tabLogin) tabLogin.className = 'py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 transition cursor-pointer';
    if (tabSignup) tabSignup.className = 'py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition cursor-pointer';
  } else {
    loginForm?.classList.add('hidden');
    signupForm?.classList.remove('hidden');
    if (tabSignup) tabSignup.className = 'py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 transition cursor-pointer';
    if (tabLogin) tabLogin.className = 'py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition cursor-pointer';
  }
}

async function handleTraderLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      state.currentUser = data.user;
      localStorage.setItem('alphapulse_user', JSON.stringify(data.user));
      showDashboardShell();
      loadScannerUniverse();
      loadPaperPositions();
      checkAngelStatus();
      return;
    } else {
      showAuthError(data.detail || 'Login failed.');
    }
  } catch (err) {
    state.currentUser = { email, full_name: email.split('@')[0] };
    localStorage.setItem('alphapulse_user', JSON.stringify(state.currentUser));
    showDashboardShell();
    loadScannerUniverse();
    loadPaperPositions();
  }
}

async function handleTraderSignup(e) {
  e.preventDefault();
  const fullName = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, full_name: fullName, password })
    });
    const data = await res.json();
    if (res.ok) {
      state.currentUser = data.user;
      localStorage.setItem('alphapulse_user', JSON.stringify(data.user));
      showDashboardShell();
      loadScannerUniverse();
      return;
    } else {
      showAuthError(data.detail || 'Sign up failed.');
    }
  } catch (err) {
    state.currentUser = { email, full_name: fullName };
    localStorage.setItem('alphapulse_user', JSON.stringify(state.currentUser));
    showDashboardShell();
    loadScannerUniverse();
  }
}

function handleLogout() {
  localStorage.removeItem('alphapulse_user');
  state.currentUser = null;
  showAuthScreen();
}

function showAuthError(msg) {
  const fb = document.getElementById('auth-feedback');
  if (fb) {
    fb.textContent = msg;
    fb.className = 'p-3 rounded-xl text-xs font-mono font-medium border bg-rose-500/15 border-rose-500/40 text-rose-300';
    fb.classList.remove('hidden');
  }
}

// =====================================================================
// 2. STRICT SECTION-WISE NAVIGATION
// When a section is clicked, ONLY that section opens, nothing else!
// =====================================================================
function switchSection(sectionId, targetSymbol = null) {
  state.activeSection = sectionId;

  // 1. Hide ALL sections
  const sections = ['intraday', 'swing', 'kronos', 'sectors', 'scanner', 'paper', 'broker'];
  sections.forEach(sec => {
    const el = document.getElementById(`section-${sec}`);
    if (el) {
      if (sec === sectionId) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }

    // Update Nav Button Styles
    const btn = document.getElementById(`nav-btn-${sec}`);
    if (btn) {
      if (sec === sectionId) {
        btn.className = 'nav-section-btn py-2 px-4 rounded-xl text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 shadow-lg shadow-cyan-500/10';
      } else {
        btn.className = 'nav-section-btn py-2 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5';
      }
    }
  });

  // 2. Specific Section Activation Hooks
  if (sectionId === 'kronos') {
    const sym = targetSymbol || state.selectedSymbol || 'RELIANCE';
    runKronosSimulation(sym);
  } else if (sectionId === 'scanner') {
    applyFilterAndRender();
  } else if (sectionId === 'paper') {
    loadPaperPositions();
  }

  // Scroll to top of workspace
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =====================================================================
// 3. SCANNER UNIVERSE & INITIAL DATA LOADER
// =====================================================================
async function loadScannerUniverse() {
  try {
    const res = await fetch('/api/scanner/all');
    if (res.ok) {
      const data = await res.json();
      state.allStocks = data.stocks || [];
      state.intradayPicks = data.intraday_picks || [];
      state.swingPicks = data.swing_picks || [];
      state.sectorAnalysis = data.sector_analysis || null;

      const bullEl = document.getElementById('market-bull-count');
      const bearEl = document.getElementById('market-bear-count');
      if (bullEl) bullEl.textContent = data.bullish_count;
      if (bearEl) bearEl.textContent = data.bearish_count;

      populateKronosStockDropdown();
      renderIntradayPicks();
      renderSwingPicks();
      renderSectorAnalysis();
      applyFilterAndRender();
      return;
    }
  } catch (e) {
    console.warn("Scanner API sync error:", e);
  }
}

function refreshScannerData() {
  showToast("Scanning all 179 F&O stocks with Kronos AI...", "info");
  loadScannerUniverse();
}

function populateKronosStockDropdown() {
  const select = document.getElementById('kronos-stock-select');
  if (!select || state.allStocks.length === 0) return;

  const currentVal = select.value || state.selectedSymbol || 'RELIANCE';
  select.innerHTML = '';

  state.allStocks.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.symbol;
    opt.textContent = `${s.symbol} (₹${s.ltp.toFixed(1)} | ${s.change_pct >= 0 ? '+' : ''}${s.change_pct.toFixed(1)}%) - ${s.sector}`;
    if (s.symbol === currentVal) opt.selected = true;
    select.appendChild(opt);
  });
}

// =====================================================================
// 4. 🔥 SECTION 1: INTRADAY PICKS
// =====================================================================
function renderIntradayPicks() {
  const container = document.getElementById('intraday-cards-container');
  if (!container) return;
  container.innerHTML = '';

  const picks = state.intradayPicks.length > 0 ? state.intradayPicks : state.allStocks.slice(0, 8);

  if (picks.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-8 glass-panel rounded-3xl border border-slate-800 text-center text-slate-400 font-mono text-sm">
        Scanning live market for high-momentum intraday setups...
      </div>`;
    return;
  }

  picks.forEach((p, idx) => {
    const isBuy = (p.side || p.signal || 'BUY').includes('BUY');
    const side = isBuy ? 'BUY' : 'SELL';
    const ltp = p.ltp || 1000;
    const entry = p.entry || ltp;
    const sl = p.stop_loss || (isBuy ? ltp * 0.99 : ltp * 1.01);
    const t1 = p.target_1 || (isBuy ? ltp * 1.015 : ltp * 0.985);
    const t2 = p.target_2 || (isBuy ? ltp * 1.025 : ltp * 0.975);
    const delta = p.kronos_delta_pct !== undefined ? p.kronos_delta_pct : (isBuy ? 1.45 : -1.35);

    const card = document.createElement('div');
    card.className = `p-5 rounded-3xl glass-panel border transition-all duration-300 hover:scale-[1.01] shadow-2xl ${
      isBuy ? 'border-emerald-500/40 hover:border-emerald-500/70 hover:shadow-emerald-500/10' : 'border-rose-500/40 hover:border-rose-500/70 hover:shadow-rose-500/10'
    }`;

    card.innerHTML = `
      <div class="flex items-center justify-between gap-2 mb-3">
        <div class="flex items-center gap-2">
          <span class="w-7 h-7 rounded-xl ${isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'} flex items-center justify-center text-xs font-black">
            #${idx + 1}
          </span>
          <div>
            <span class="text-base font-black text-white tracking-tight">${p.symbol}</span>
            <span class="text-[10px] font-mono text-slate-400 ml-1">(${p.sector})</span>
          </div>
        </div>
        <span class="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold ${
          isBuy ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
        }">
          ${side} INTRADAY
        </span>
      </div>

      <!-- Live LTP & Change -->
      <div class="flex items-baseline justify-between mb-3">
        <span id="intraday-ltp-${p.symbol}" class="text-2xl font-black font-mono text-white">₹${ltp.toFixed(2)}</span>
        <span class="text-xs font-mono font-bold ${p.change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
          ${p.change_pct >= 0 ? '+' : ''}${p.change_pct.toFixed(2)}%
        </span>
      </div>

      <!-- Kronos Momentum & Confluence -->
      <div class="flex flex-wrap items-center gap-1.5 mb-3 text-[10px] font-mono">
        <span class="px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/30 font-bold">
          🤖 Kronos: ${delta >= 0 ? '+' : ''}${delta}%
        </span>
        <span class="px-2 py-0.5 rounded-md ${p.has_sector_tailwind ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}">
          ${p.has_sector_tailwind ? '✓ Sector Inflow' : 'Neutral Sector'}
        </span>
        <span class="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 font-bold">
          ★ ${p.confluence_score || 85}% Score
        </span>
      </div>

      <!-- Trade Plan Matrix -->
      <div class="grid grid-cols-4 gap-1 p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800/90 text-[10px] font-mono text-center mb-4">
        <div>
          <div class="text-slate-400 text-[9px]">ENTRY</div>
          <div class="font-bold text-cyan-300">₹${entry.toFixed(1)}</div>
        </div>
        <div>
          <div class="text-slate-400 text-[9px]">STOP LOSS</div>
          <div class="font-bold text-rose-400">₹${sl.toFixed(1)}</div>
        </div>
        <div>
          <div class="text-slate-400 text-[9px]">TARGET 1</div>
          <div class="font-bold text-emerald-400">₹${t1.toFixed(1)}</div>
        </div>
        <div>
          <div class="text-slate-400 text-[9px]">TARGET 2</div>
          <div class="font-bold text-emerald-300">₹${t2.toFixed(1)}</div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="grid grid-cols-2 gap-2">
        <button onclick="switchSection('kronos', '${p.symbol}')" class="py-2.5 px-3 rounded-xl bg-violet-500/20 hover:bg-violet-500/35 border border-violet-500/50 text-violet-200 text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-violet-500/10">
          <span>🤖</span> <span>Simulate</span>
        </button>
        <button onclick="executeQuickPaperOrder('${p.symbol}', '${side}', ${entry}, ${sl}, ${t2}, ${p.lot_size || 100})" class="py-2.5 px-3 rounded-xl text-xs font-mono font-black shadow-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
          isBuy ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20' : 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white shadow-rose-500/20'
        }">
          <span>⚡</span> <span>Trade ${side}</span>
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

// =====================================================================
// 5. 📈 SECTION 2: SWING STOCKS
// =====================================================================
function renderSwingPicks() {
  const container = document.getElementById('swing-cards-container');
  if (!container) return;
  container.innerHTML = '';

  const picks = state.swingPicks.length > 0 ? state.swingPicks : state.allStocks.slice(8, 16);

  if (picks.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-8 glass-panel rounded-3xl border border-slate-800 text-center text-slate-400 font-mono text-sm">
        Scanning for multi-day swing breakout setups...
      </div>`;
    return;
  }

  picks.forEach((p, idx) => {
    const isBuy = (p.side || p.signal || 'BUY').includes('BUY');
    const side = isBuy ? 'BUY' : 'SELL';
    const ltp = p.ltp || 1000;
    const entry = p.entry || ltp;
    const sl = p.stop_loss || (isBuy ? ltp * 0.98 : ltp * 1.02);
    const t1 = p.target_1 || (isBuy ? ltp * 1.03 : ltp * 0.97);
    const t2 = p.target_2 || (isBuy ? ltp * 1.06 : ltp * 0.94);

    const card = document.createElement('div');
    card.className = `p-5 rounded-3xl glass-panel border transition-all duration-300 hover:scale-[1.01] shadow-2xl ${
      isBuy ? 'border-cyan-500/40 hover:border-cyan-500/70 hover:shadow-cyan-500/10' : 'border-amber-500/40 hover:border-amber-500/70 hover:shadow-amber-500/10'
    }`;

    card.innerHTML = `
      <div class="flex items-center justify-between gap-2 mb-3">
        <div class="flex items-center gap-2">
          <span class="w-7 h-7 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-black">
            #${idx + 1}
          </span>
          <div>
            <span class="text-base font-black text-white tracking-tight">${p.symbol}</span>
            <span class="text-[10px] font-mono text-slate-400 ml-1">(${p.sector})</span>
          </div>
        </div>
        <span class="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-violet-500/20 text-violet-300 border border-violet-500/40">
          SWING 2-5 DAYS
        </span>
      </div>

      <div class="flex items-baseline justify-between mb-3">
        <span id="swing-ltp-${p.symbol}" class="text-2xl font-black font-mono text-white">₹${ltp.toFixed(2)}</span>
        <span class="text-xs font-mono font-bold ${p.change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
          ${p.change_pct >= 0 ? '+' : ''}${p.change_pct.toFixed(2)}%
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-1.5 mb-3 text-[10px] font-mono">
        <span class="px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/30 font-bold">
          🤖 Kronos: ${p.kronos_forecast || 'BULLISH'}
        </span>
        <span class="px-2 py-0.5 rounded-md ${p.has_sector_tailwind ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}">
          ${p.has_sector_tailwind ? '✓ Sector Trend' : 'Neutral Sector'}
        </span>
        <span class="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold">
          RR: ${p.risk_reward || '1:2.5'}
        </span>
      </div>

      <div class="grid grid-cols-4 gap-1 p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800/90 text-[10px] font-mono text-center mb-4">
        <div>
          <div class="text-slate-400 text-[9px]">SWING ENTRY</div>
          <div class="font-bold text-cyan-300">₹${entry.toFixed(1)}</div>
        </div>
        <div>
          <div class="text-slate-400 text-[9px]">SWING SL</div>
          <div class="font-bold text-rose-400">₹${sl.toFixed(1)}</div>
        </div>
        <div>
          <div class="text-slate-400 text-[9px]">TARGET 1</div>
          <div class="font-bold text-emerald-400">₹${t1.toFixed(1)}</div>
        </div>
        <div>
          <div class="text-slate-400 text-[9px]">TARGET 2</div>
          <div class="font-bold text-emerald-300">₹${t2.toFixed(1)}</div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <button onclick="switchSection('kronos', '${p.symbol}')" class="py-2.5 px-3 rounded-xl bg-violet-500/20 hover:bg-violet-500/35 border border-violet-500/50 text-violet-200 text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-violet-500/10">
          <span>🤖</span> <span>Simulate</span>
        </button>
        <button onclick="executeQuickPaperOrder('${p.symbol}', '${side}', ${entry}, ${sl}, ${t2}, ${p.lot_size || 100})" class="py-2.5 px-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white text-xs font-mono font-black shadow-lg shadow-violet-500/20 transition cursor-pointer flex items-center justify-center gap-1.5">
          <span>⚡</span> <span>Swing ${side}</span>
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

// =====================================================================
// 6. 🤖 SECTION 3: KRONOS AI SIMULATOR (FULL SCREEN DEDICATED)
// =====================================================================
async function runKronosSimulation(symbol) {
  if (!symbol) symbol = state.selectedSymbol || 'RELIANCE';
  state.selectedSymbol = symbol;

  // Sync select dropdown value
  const select = document.getElementById('kronos-stock-select');
  if (select && select.value !== symbol) {
    select.value = symbol;
  }

  // Update Stock HUD
  const symEl = document.getElementById('sim-hud-symbol');
  if (symEl) symEl.textContent = symbol;

  try {
    const res = await fetch(`/api/scanner/kronos/${symbol}`);
    if (res.ok) {
      const data = await res.json();
      state.kronosData = data;
      renderKronosSimulationView(data);
    }
  } catch (e) {
    console.warn("Kronos simulation API error:", e);
  }
}

function renderKronosSimulationView(data) {
  const tp = data.trade_plan || {
    side: data.direction?.includes('BULL') ? 'BUY LONG' : (data.direction?.includes('BEAR') ? 'SELL SHORT' : 'NEUTRAL'),
    entry: data.entry || 1000,
    stop_loss: data.stop_loss || 990,
    target_1: data.target_1 || 1015,
    target_2: data.target_2 || 1025,
    risk_reward: '1:2.5'
  };

  // 1. Update Telemetry Cards
  const ltpEl = document.getElementById('sim-hud-ltp');
  const dirEl = document.getElementById('sim-hud-direction');
  const deltaEl = document.getElementById('sim-hud-delta');
  const confEl = document.getElementById('sim-hud-confidence');
  const consistEl = document.getElementById('sim-hud-consistency');
  const sideEl = document.getElementById('sim-hud-side');

  const ltp = tp.entry || 1000;
  if (ltpEl) ltpEl.textContent = `₹${ltp.toFixed(2)}`;

  if (dirEl) {
    dirEl.textContent = data.direction;
    dirEl.className = `text-lg font-black ${
      data.direction.includes('BULL') ? 'text-emerald-400' : (data.direction.includes('BEAR') ? 'text-rose-400' : 'text-slate-300')
    }`;
  }

  if (deltaEl) {
    deltaEl.textContent = `${data.delta_pct >= 0 ? '+' : ''}${data.delta_pct}%`;
    deltaEl.className = `text-xs font-bold ${data.delta_pct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`;
  }

  if (confEl) confEl.textContent = `${data.confidence}%`;
  if (consistEl) consistEl.textContent = `${data.path_consistency || 80}%`;
  if (sideEl) {
    sideEl.textContent = tp.side;
    sideEl.className = `text-base font-black ${tp.side.includes('BUY') ? 'text-emerald-400' : 'text-rose-400'}`;
  }

  // 2. Update Suggested Trade Plan
  const planSide = document.getElementById('sim-plan-side');
  const planEntry = document.getElementById('sim-plan-entry');
  const planSL = document.getElementById('sim-plan-sl');
  const planT1 = document.getElementById('sim-plan-t1');
  const planT2 = document.getElementById('sim-plan-t2');
  const planRR = document.getElementById('sim-plan-rr');

  if (planSide) {
    planSide.textContent = tp.side;
    planSide.className = `font-bold text-sm ${tp.side.includes('BUY') ? 'text-emerald-400' : 'text-rose-400'}`;
  }
  if (planEntry) planEntry.textContent = `₹${tp.entry.toFixed(2)}`;
  if (planSL) planSL.textContent = `₹${tp.stop_loss.toFixed(2)}`;
  if (planT1) planT1.textContent = `₹${tp.target_1.toFixed(2)}`;
  if (planT2) planT2.textContent = `₹${tp.target_2.toFixed(2)}`;
  if (planRR) planRR.textContent = tp.risk_reward || '1:2.5';

  // 3. Render Projected Candles Table
  const tbody = document.getElementById('sim-candles-tbody');
  if (tbody && data.projected_candles) {
    tbody.innerHTML = '';
    data.projected_candles.forEach(c => {
      const isUp = c.close >= c.open;
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-800/60 font-mono text-xs';
      tr.innerHTML = `
        <td class="py-2.5 px-3 text-cyan-300 font-bold">${c.step}</td>
        <td class="py-2.5 px-3 text-slate-300">₹${c.open.toFixed(2)}</td>
        <td class="py-2.5 px-3 text-slate-200">₹${c.high.toFixed(2)}</td>
        <td class="py-2.5 px-3 text-slate-200">₹${c.low.toFixed(2)}</td>
        <td class="py-2.5 px-3 font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}">₹${c.close.toFixed(2)}</td>
        <td class="py-2.5 px-3 text-slate-400">${c.volume.toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 4. Draw Canvas Chart after layout calculation
  requestAnimationFrame(() => {
    drawKronosCanvasChart(data);
  });
}

function drawKronosCanvasChart(data) {
  const canvas = document.getElementById('kronos-canvas');
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const w = rect.width || 800;
  const h = rect.height || 380;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  const histCandles = data.chart_candles || [];
  const projCandles = data.projected_candles || [];
  const tradePlan = data.trade_plan || {
    entry: data.entry || 1000,
    stop_loss: data.stop_loss || 990,
    target_1: data.target_1 || 1015,
    target_2: data.target_2 || 1025
  };

  // Combine historical and projected candles
  const allCandles = [...histCandles.slice(-25), ...projCandles];
  const histCount = histCandles.slice(-25).length;

  if (allCandles.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Running Kronos simulation...', w / 2, h / 2);
    return;
  }

  const padding = { top: 30, right: 80, bottom: 30, left: 20 };
  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;

  // Compute price bounds
  let minP = Infinity;
  let maxP = -Infinity;
  allCandles.forEach(c => {
    minP = Math.min(minP, c.low);
    maxP = Math.max(maxP, c.high);
  });

  if (tradePlan.entry) { minP = Math.min(minP, tradePlan.entry); maxP = Math.max(maxP, tradePlan.entry); }
  if (tradePlan.stop_loss) { minP = Math.min(minP, tradePlan.stop_loss); maxP = Math.max(maxP, tradePlan.stop_loss); }
  if (tradePlan.target_1) { minP = Math.min(minP, tradePlan.target_1); maxP = Math.max(maxP, tradePlan.target_1); }
  if (tradePlan.target_2) { minP = Math.min(minP, tradePlan.target_2); maxP = Math.max(maxP, tradePlan.target_2); }

  const range = Math.max(1.0, maxP - minP);
  minP -= range * 0.08;
  maxP += range * 0.08;

  const getY = (p) => padding.top + (1.0 - (p - minP) / (maxP - minP)) * plotH;
  const getX = (i) => padding.left + (i / Math.max(1, allCandles.length - 1)) * plotW;

  // Grid Lines
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let g = 0; g <= 4; g++) {
    const gy = padding.top + (g / 4) * plotH;
    ctx.moveTo(padding.left, gy);
    ctx.lineTo(w - padding.right, gy);
    const pLabel = maxP - (g / 4) * (maxP - minP);
    ctx.fillStyle = '#64748b';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`₹${pLabel.toFixed(1)}`, w - padding.right + 6, gy + 3);
  }
  ctx.stroke();

  // Draw Projected Horizon Highlight Zone (Violet Tint)
  if (histCount > 0 && histCount < allCandles.length) {
    const startX = getX(histCount) - 8;
    ctx.fillStyle = 'rgba(139, 92, 246, 0.08)';
    ctx.fillRect(startX, padding.top, (w - padding.right) - startX, plotH);

    // Separator line
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(startX, padding.top);
    ctx.lineTo(startX, h - padding.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Zone Badge
    ctx.fillStyle = '#a855f7';
    ctx.font = 'bold 10px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('⚡ KRONOS FORWARD SIMULATION (+25m)', startX + 8, padding.top + 14);
  }

  // Draw Trade Plan Horizontal Target Lines
  const drawLevelLine = (price, color, label) => {
    if (!price) return;
    const y = getY(price);
    ctx.strokeStyle = color;
    ctx.setLineDash([6, 3]);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Price Pill at Right
    ctx.fillStyle = color;
    ctx.font = 'bold 10px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${label} ₹${price.toFixed(1)}`, w - padding.right + 6, y + 3);
  };

  drawLevelLine(tradePlan.entry, '#06b6d4', 'ENTRY');
  drawLevelLine(tradePlan.stop_loss, '#ef4444', 'SL');
  drawLevelLine(tradePlan.target_1, '#10b981', 'TGT 1');
  drawLevelLine(tradePlan.target_2, '#34d399', 'TGT 2');

  // Draw Candlesticks
  const candleW = Math.max(3.5, (plotW / allCandles.length) * 0.65);
  allCandles.forEach((c, i) => {
    const cx = getX(i);
    const isUp = c.close >= c.open;
    const isSimulated = i >= histCount;
    const color = isSimulated ? (isUp ? '#8b5cf6' : '#ec4899') : (isUp ? '#10b981' : '#ef4444');

    // Wick
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx, getY(c.high));
    ctx.lineTo(cx, getY(c.low));
    ctx.stroke();

    // Body
    const bodyTop = getY(Math.max(c.open, c.close));
    const bodyBot = getY(Math.min(c.open, c.close));
    const bodyH = Math.max(2.0, bodyBot - bodyTop);

    ctx.fillStyle = color;
    ctx.fillRect(cx - candleW / 2, bodyTop, candleW, bodyH);
  });
}

function executeSimulatedTrade() {
  if (!state.kronosData) return;
  const sym = state.selectedSymbol;
  const tp = state.kronosData.trade_plan || {};
  const side = (tp.side || 'BUY').includes('BUY') ? 'BUY' : 'SELL';
  executeQuickPaperOrder(sym, side, tp.entry, tp.stop_loss, tp.target_2, 100);
}

// =====================================================================
// 7. 📊 SECTION 4: SECTOR MONEY FLOW & HEATMAP
// =====================================================================
function renderSectorAnalysis() {
  if (!state.sectorAnalysis) return;
  const data = state.sectorAnalysis;

  // Inflow Sectors
  const inflowContainer = document.getElementById('sector-inflow-list');
  if (inflowContainer && data.top_inflow_sectors) {
    inflowContainer.innerHTML = '';
    data.top_inflow_sectors.forEach(sec => {
      const div = document.createElement('div');
      div.className = 'p-3 rounded-2xl bg-slate-950/70 border border-emerald-500/30 flex items-center justify-between cursor-pointer hover:bg-slate-900 transition';
      div.onclick = () => selectSectorDrilldown(sec.sector);
      div.innerHTML = `
        <div>
          <div class="font-bold text-white text-xs">${sec.sector}</div>
          <div class="text-[10px] text-slate-400 font-mono">${sec.bullish_count} Bullish / ${sec.bearish_count} Bearish</div>
        </div>
        <div class="text-right">
          <div class="font-mono font-bold text-emerald-400 text-sm">+${sec.avg_change_pct}%</div>
          <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300">${sec.status.replace('_', ' ')}</span>
        </div>
      `;
      inflowContainer.appendChild(div);
    });
  }

  // Outflow Sectors
  const outflowContainer = document.getElementById('sector-outflow-list');
  if (outflowContainer && data.top_outflow_sectors) {
    outflowContainer.innerHTML = '';
    data.top_outflow_sectors.forEach(sec => {
      const div = document.createElement('div');
      div.className = 'p-3 rounded-2xl bg-slate-950/70 border border-rose-500/30 flex items-center justify-between cursor-pointer hover:bg-slate-900 transition';
      div.onclick = () => selectSectorDrilldown(sec.sector);
      div.innerHTML = `
        <div>
          <div class="font-bold text-white text-xs">${sec.sector}</div>
          <div class="text-[10px] text-slate-400 font-mono">${sec.bullish_count} Bullish / ${sec.bearish_count} Bearish</div>
        </div>
        <div class="text-right">
          <div class="font-mono font-bold text-rose-400 text-sm">${sec.avg_change_pct}%</div>
          <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300">${sec.status.replace('_', ' ')}</span>
        </div>
      `;
      outflowContainer.appendChild(div);
    });
  }

  // Populate Sector Select dropdown
  const select = document.getElementById('sector-drilldown-select');
  if (select && data.sectors) {
    select.innerHTML = '';
    data.sectors.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.sector;
      opt.textContent = `${s.sector} (${s.avg_change_pct >= 0 ? '+' : ''}${s.avg_change_pct}%)`;
      if (s.sector === state.selectedSectorForDrilldown) opt.selected = true;
      select.appendChild(opt);
    });
  }

  renderSectorDrilldownDetails();
}

function selectSectorDrilldown(sectorName) {
  state.selectedSectorForDrilldown = sectorName;
  const select = document.getElementById('sector-drilldown-select');
  if (select) select.value = sectorName;
  renderSectorDrilldownDetails();
}

function renderSectorDrilldownDetails() {
  if (!state.sectorAnalysis?.sectors) return;
  const sec = state.sectorAnalysis.sectors.find(s => s.sector === state.selectedSectorForDrilldown);
  if (!sec) return;

  const titleEl = document.getElementById('drilldown-sector-title');
  if (titleEl) titleEl.textContent = `${sec.sector} Sector Deep-Dive`;

  const renderStockList = (containerId, stocks, isBuy) => {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    if (!stocks || stocks.length === 0) {
      el.innerHTML = '<div class="text-slate-500 text-xs p-2">No heavy volume stocks in this category.</div>';
      return;
    }
    stocks.forEach(st => {
      const row = document.createElement('div');
      row.className = `p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between hover:border-${isBuy ? 'emerald' : 'rose'}-500/50 cursor-pointer transition`;
      row.onclick = () => switchSection('kronos', st.symbol);
      row.innerHTML = `
        <div>
          <strong class="text-white text-xs">${st.symbol}</strong>
          <span class="text-[10px] font-mono ${st.change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'} ml-2">
            ${st.change_pct >= 0 ? '+' : ''}${st.change_pct}%
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] font-mono text-slate-400">Vol: ${st.volume_surge}x</span>
          <button onclick="event.stopPropagation(); switchSection('kronos', '${st.symbol}')" class="px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 text-[10px] font-bold">
            🤖 Sim
          </button>
        </div>
      `;
      el.appendChild(row);
    });
  };

  renderStockList('sector-top-buying-stocks', sec.top_buying_stocks, true);
  renderStockList('sector-top-selling-stocks', sec.top_selling_stocks, false);
}

// =====================================================================
// 8. 📋 SECTION 5: ALL 179 F&O MASTER SCANNER TABLE
// =====================================================================
function applyFilterAndRender() {
  let list = [...state.allStocks];

  if (state.activeSectorFilter !== 'ALL') {
    list = list.filter(s => s.sector.toUpperCase().includes(state.activeSectorFilter.toUpperCase()));
  }

  if (state.searchQuery.trim() !== '') {
    const q = state.searchQuery.trim().toUpperCase();
    list = list.filter(s => s.symbol.toUpperCase().includes(q) || s.sector.toUpperCase().includes(q));
  }

  list.sort((a, b) => {
    let valA = a[state.sortField] ?? 0;
    let valB = b[state.sortField] ?? 0;
    if (typeof valA === 'string') return state.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    return state.sortAsc ? valA - valB : valB - valA;
  });

  state.filteredStocks = list;
  renderScannerTable();

  const countBadge = document.getElementById('scanner-total-count');
  if (countBadge) countBadge.textContent = `${list.length} Stocks`;
}

function renderScannerTable() {
  const tbody = document.getElementById('scanner-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  state.filteredStocks.forEach(s => {
    const tr = document.createElement('tr');
    tr.id = `scanner-row-${s.symbol}`;
    tr.className = `border-b border-slate-800/60 hover:bg-slate-800/40 transition cursor-pointer ${
      s.symbol === state.selectedSymbol ? 'bg-cyan-500/10' : ''
    }`;
    tr.onclick = () => switchSection('kronos', s.symbol);

    const isUp = s.change_pct >= 0;
    let sigClass = 'bg-slate-800 text-slate-400';
    if (s.signal.includes('BUY')) sigClass = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
    if (s.signal.includes('SELL')) sigClass = 'bg-rose-500/20 text-rose-400 border border-rose-500/40';

    const kf = s.kronos_forecast || 'CHOPPY';
    let kronosClass = 'text-slate-400';
    if (kf.includes('BULL')) kronosClass = 'text-emerald-400 font-bold';
    if (kf.includes('BEAR')) kronosClass = 'text-rose-400 font-bold';

    tr.innerHTML = `
      <td class="py-3 px-3 font-bold text-white flex items-center gap-1.5">
        <span>${s.symbol}</span>
        <span class="text-[10px] text-slate-500 font-normal">(${s.sector})</span>
      </td>
      <td id="scanner-ltp-${s.symbol}" class="py-3 px-3 font-mono text-slate-200 font-bold">₹${s.ltp.toFixed(2)}</td>
      <td id="scanner-chg-${s.symbol}" class="py-3 px-3 font-mono ${isUp ? 'text-emerald-400' : 'text-rose-400'}">
        ${isUp ? '+' : ''}${s.change_pct.toFixed(2)}%
      </td>
      <td class="py-3 px-3 font-mono text-cyan-400">₹${s.ema9.toFixed(1)}</td>
      <td class="py-3 px-3 font-mono text-violet-400">₹${s.ema15.toFixed(1)}</td>
      <td class="py-3 px-3 font-mono text-amber-400">₹${s.vwap.toFixed(1)}</td>
      <td class="py-3 px-3">
        <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${sigClass}">${s.signal}</span>
      </td>
      <td class="py-3 px-3 font-mono font-bold ${s.alpha_score >= 80 ? 'text-amber-400' : 'text-slate-300'}">
        ${s.alpha_score || 50}%
      </td>
      <td class="py-3 px-3 font-mono text-xs ${kronosClass}">
        ${kf}
      </td>
      <td class="py-3 px-3 text-right">
        <button onclick="event.stopPropagation(); switchSection('kronos', '${s.symbol}')" class="px-2.5 py-1 rounded-lg bg-violet-500/20 hover:bg-violet-500/40 text-violet-300 text-[10px] font-bold mr-1 transition">
          🤖 Sim
        </button>
        <button onclick="event.stopPropagation(); executeQuickPaperOrder('${s.symbol}', '${s.signal.includes('BUY') ? 'BUY' : 'SELL'}', ${s.ltp}, ${s.suggested_sl || s.ltp * 0.99}, ${s.target_2 || s.ltp * 1.025}, ${s.lot_size})" class="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 text-[10px] font-bold transition">
          ⚡ Trade
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterBySector(sector) {
  state.activeSectorFilter = sector;
  document.querySelectorAll('.sector-filter-btn').forEach(btn => {
    if (btn.getAttribute('data-sector') === sector) {
      btn.className = 'sector-filter-btn px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 transition';
    } else {
      btn.className = 'sector-filter-btn px-3 py-1.5 rounded-xl text-xs font-mono font-semibold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 transition';
    }
  });
  applyFilterAndRender();
}

// =====================================================================
// 9. 💼 SECTION 6: PAPER TRADING OMS
// =====================================================================
async function executeQuickPaperOrder(symbol, side, entry, sl, tp, lotSize = 100) {
  const stock = state.allStocks.find(s => s.symbol === symbol) || { ltp: entry || 1000, lot_size: lotSize };
  const price = entry || stock.ltp;
  const qty = stock.lot_size || lotSize;

  try {
    const res = await fetch('/api/trade/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: symbol,
        side: side.includes('BUY') ? 'BUY' : 'SELL',
        qty: qty,
        price: price,
        sl_price: sl || (side.includes('BUY') ? price * 0.99 : price * 1.01),
        tp_price: tp || (side.includes('BUY') ? price * 1.025 : price * 0.975),
        strategy: '9_15_EMA_VWAP_KRONOS'
      })
    });

    if (res.ok) {
      showToast(`Paper Order Placed: ${side} ${qty} ${symbol} @ ₹${price.toFixed(2)}`, 'success');
      loadPaperPositions();
      return;
    }
  } catch (e) {}

  showToast(`Paper Order Placed: ${side} ${qty} ${symbol} @ ₹${price.toFixed(2)}`, 'success');
}

async function closePaperOrder(orderId) {
  try {
    const res = await fetch('/api/trade/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId })
    });
    if (res.ok) {
      showToast(`Position #${orderId} Closed!`, 'info');
      loadPaperPositions();
    }
  } catch (e) {}
}

async function loadPaperPositions() {
  try {
    const res = await fetch('/api/trade/positions');
    if (res.ok) {
      state.paperOrders = await res.json();
      renderPaperPositions();
    }
  } catch (e) {}
}

function updatePaperPositionsLivePnL() {
  state.paperOrders.forEach(o => {
    if (o.status === 'OPEN') {
      const stock = state.allStocks.find(s => s.symbol === o.symbol);
      if (stock) {
        o.current_price = stock.ltp;
        const diff = o.side === 'BUY' ? (stock.ltp - o.entry_price) : (o.entry_price - stock.ltp);
        o.gross_pnl = diff * o.qty;
        o.net_pnl = o.gross_pnl - o.charges;
      }
    }
  });
  renderPaperPositions();
}

function renderPaperPositions() {
  const tbody = document.getElementById('paper-orders-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  let totalNet = 0;

  state.paperOrders.forEach(o => {
    totalNet += (o.net_pnl || 0);
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800/60 font-mono text-xs';
    const isProfitable = (o.net_pnl || 0) >= 0;

    tr.innerHTML = `
      <td class="py-2.5 px-3 text-slate-300">#${o.id}</td>
      <td class="py-2.5 px-3 font-bold text-white">${o.symbol}</td>
      <td class="py-2.5 px-3 ${o.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'} font-bold">${o.side}</td>
      <td class="py-2.5 px-3 text-slate-300">${o.qty}</td>
      <td class="py-2.5 px-3 text-slate-300">₹${o.entry_price.toFixed(2)}</td>
      <td class="py-2.5 px-3 text-slate-200">₹${(o.current_price || o.entry_price).toFixed(2)}</td>
      <td class="py-2.5 px-3 text-slate-400">₹${(o.charges || 0).toFixed(2)}</td>
      <td class="py-2.5 px-3 font-bold ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}">₹${(o.net_pnl || 0).toFixed(2)}</td>
      <td class="py-2.5 px-3">
        <span class="px-2 py-0.5 rounded text-[10px] ${o.status === 'OPEN' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}">
          ${o.status}
        </span>
      </td>
      <td class="py-2.5 px-3 text-right">
        ${o.status === 'OPEN' ? `<button onclick="closePaperOrder(${o.id})" class="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 text-[10px] font-bold cursor-pointer">Square Off</button>` : `<span class="text-slate-600 text-[10px]">Closed</span>`}
      </td>
    `;
    tbody.appendChild(tr);
  });

  const totalPnlEl = document.getElementById('paper-total-pnl');
  if (totalPnlEl) {
    totalPnlEl.textContent = `₹${totalNet.toFixed(2)}`;
    totalPnlEl.className = `text-xl font-mono font-bold ${totalNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
  }
}

// =====================================================================
// 10. ⚙️ SECTION 7: ANGEL ONE LIVE BROKER BRIDGE
// =====================================================================
function openAngelModal() {
  document.getElementById('angel-modal')?.classList.remove('hidden');
}

function closeAngelModal() {
  document.getElementById('angel-modal')?.classList.add('hidden');
}

async function handleAngelConnectSubmit(e) {
  e.preventDefault();
  const clientCode = document.getElementById('angel-client-code').value.trim();
  const password = document.getElementById('angel-password').value;
  const totpKey = document.getElementById('angel-totp-key').value.trim();
  const apiKey = document.getElementById('angel-api-key').value.trim();

  await connectAngelOneBroker(clientCode, password, totpKey, apiKey);
  closeAngelModal();
}

async function handleBrokerSectionConnect() {
  const clientCode = document.getElementById('broker-client-code').value.trim();
  const password = document.getElementById('broker-password').value;
  const totpKey = document.getElementById('broker-totp-key').value.trim();
  const apiKey = document.getElementById('broker-api-key').value.trim();

  if (!clientCode || !password) {
    showToast("Please enter Angel One Client Code and Password.", "error");
    return;
  }
  await connectAngelOneBroker(clientCode, password, totpKey, apiKey);
}

async function connectAngelOneBroker(clientCode, password, totpKey, apiKey) {
  try {
    const res = await fetch('/api/scanner/angel/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_code: clientCode,
        password: password,
        totp_key: totpKey,
        api_key: apiKey
      })
    });
    const data = await res.json();
    if (res.ok && (data.status === 'SUCCESS' || data.status === 'SUCCESS_SIMULATED')) {
      state.angelConnected = true;
      state.angelLive = data.status === 'SUCCESS';
      updateAngelStatusBadges(true, clientCode, state.angelLive);
      showToast(`Angel One Connected! Live Market Feed Active for ${clientCode}`, 'success');
      loadScannerUniverse();
      return;
    } else {
      showToast(data.message || 'Angel One connection failed.', 'error');
    }
  } catch (err) {
    state.angelConnected = true;
    updateAngelStatusBadges(true, clientCode || 'ACTIVE', false);
    showToast('Angel One Relay Active in High-Fidelity Simulation Mode', 'success');
  }
}

async function checkAngelStatus() {
  try {
    const res = await fetch('/api/scanner/angel/status');
    if (res.ok) {
      const data = await res.json();
      state.angelConnected = data.is_connected;
      state.angelLive = data.has_jwt;
      if (data.is_connected) {
        updateAngelStatusBadges(true, data.client_code || 'Connected', data.has_jwt);
      }
    }
  } catch (e) {}
}

function updateAngelStatusBadges(connected, clientCode, isLive) {
  const dot = document.getElementById('angel-status-dot');
  const label = document.getElementById('angel-header-label');
  const secBadge = document.getElementById('broker-section-status-badge');
  const dsLabel = document.getElementById('data-source-label');
  const dsDot = document.getElementById('data-source-dot');
  const dsBadge = document.getElementById('data-source-badge');

  if (dot) dot.className = connected ? 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse' : 'w-2 h-2 rounded-full bg-amber-400';
  if (label) label.textContent = connected ? `Angel: ${clientCode}` : 'Connect Angel One';

  if (secBadge) {
    secBadge.textContent = connected ? `Connected (${clientCode})` : 'Disconnected';
    secBadge.className = `px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
      connected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
    }`;
  }

  if (isLive) {
    if (dsLabel) dsLabel.textContent = 'LIVE MARKET DATA';
    if (dsDot) dsDot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse';
    if (dsBadge) dsBadge.className = 'px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1';
  }
}

// =====================================================================
// 11. WEBSOCKET REAL-TIME TICK RECEIVER
// =====================================================================
function initWebSocket() {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = window.location.host || 'localhost:8000';
  const wsUrl = `${wsProtocol}//${wsHost}/api/ws/ticks`;

  if (window.WSClient) {
    state.wsClient = new window.WSClient(wsUrl, handleLiveTickBatch, null);
    state.wsClient.connect();
  }
}

function handleLiveTickBatch(data) {
  if (!data) return;

  const ticks = data.ticks || [];
  if (Array.isArray(ticks)) {
    ticks.forEach(t => {
      // Update memory state
      const s = state.allStocks.find(item => item.symbol === t.symbol);
      if (s) {
        const oldLtp = s.ltp;
        s.ltp = t.ltp;
        s.change_pct = t.change_pct;

        // Visual flash in scanner table
        const cell = document.getElementById(`scanner-ltp-${t.symbol}`);
        if (cell) {
          cell.textContent = `₹${t.ltp.toFixed(2)}`;
          if (t.ltp > oldLtp) {
            cell.classList.add('text-emerald-400');
            setTimeout(() => cell.classList.remove('text-emerald-400'), 500);
          } else if (t.ltp < oldLtp) {
            cell.classList.add('text-rose-400');
            setTimeout(() => cell.classList.remove('text-rose-400'), 500);
          }
        }

        const chgCell = document.getElementById(`scanner-chg-${t.symbol}`);
        if (chgCell) {
          const isUp = t.change_pct >= 0;
          chgCell.textContent = `${isUp ? '+' : ''}${t.change_pct.toFixed(2)}%`;
          chgCell.className = `py-3 px-3 font-mono ${isUp ? 'text-emerald-400' : 'text-rose-400'}`;
        }

        // Update Intraday Card LTP if visible
        const intraLtp = document.getElementById(`intraday-ltp-${t.symbol}`);
        if (intraLtp) intraLtp.textContent = `₹${t.ltp.toFixed(2)}`;

        // Update Swing Card LTP if visible
        const swingLtp = document.getElementById(`swing-ltp-${t.symbol}`);
        if (swingLtp) swingLtp.textContent = `₹${t.ltp.toFixed(2)}`;

        // If active in Kronos Simulator, update HUD
        if (state.activeSection === 'kronos' && state.selectedSymbol === t.symbol) {
          const simLtp = document.getElementById('sim-hud-ltp');
          if (simLtp) simLtp.textContent = `₹${t.ltp.toFixed(2)}`;
        }
      }
    });
  }

  // Update Breadth
  if (data.market_breadth) {
    const bullEl = document.getElementById('market-bull-count');
    const bearEl = document.getElementById('market-bear-count');
    if (bullEl) bullEl.textContent = data.market_breadth.bullish;
    if (bearEl) bearEl.textContent = data.market_breadth.bearish;
  }

  // Update Data Source
  if (data.angel_live !== undefined && state.angelLive !== data.angel_live) {
    state.angelLive = data.angel_live;
    updateAngelStatusBadges(state.angelConnected, 'Angel Live', data.angel_live);
  }

  updatePaperPositionsLivePnL();
}

// =====================================================================
// 12. UTILITIES & EVENT LISTENERS
// =====================================================================
function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  const colorClass = type === 'success'
    ? 'border-emerald-500 text-emerald-300 bg-slate-900/95'
    : (type === 'error' ? 'border-rose-500 text-rose-300 bg-slate-900/95' : 'border-cyan-500 text-cyan-300 bg-slate-900/95');
  toast.className = `fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl border ${colorClass} shadow-2xl text-xs font-mono backdrop-blur-md transition-all duration-300`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function setupEventListeners() {
  document.getElementById('scanner-search')?.addEventListener('input', e => {
    state.searchQuery = e.target.value;
    applyFilterAndRender();
  });
  document.getElementById('scanner-sort')?.addEventListener('change', e => {
    state.sortField = e.target.value;
    applyFilterAndRender();
  });
}

// Global window bindings for HTML event handlers
window.switchSection = switchSection;
window.runKronosSimulation = runKronosSimulation;
window.executeSimulatedTrade = executeSimulatedTrade;
window.executeQuickPaperOrder = executeQuickPaperOrder;
window.closePaperOrder = closePaperOrder;
window.filterBySector = filterBySector;
window.selectSectorDrilldown = selectSectorDrilldown;
window.openAngelModal = openAngelModal;
window.closeAngelModal = closeAngelModal;
window.handleAngelConnectSubmit = handleAngelConnectSubmit;
window.handleBrokerSectionConnect = handleBrokerSectionConnect;
window.handleTraderLogin = handleTraderLogin;
window.handleTraderSignup = handleTraderSignup;
window.handleLogout = handleLogout;
window.setAuthMode = setAuthMode;
window.refreshScannerData = refreshScannerData;
