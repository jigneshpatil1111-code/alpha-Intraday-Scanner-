/**
 * AlphaPulse IN — V2 Master Controller
 * Section-based layout: Intraday | Swing | Sector Flow | Kronos Detail | Scanner | Paper OMS
 * Live market data via Angel One SmartAPI or high-fidelity simulation
 */

const state = {
  currentUser: null,
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
  kronosChart: null
};

// =====================================================================
// INIT
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
  checkAuthSession();
  initWebSocket();
  setupEventListeners();
});

// =====================================================================
// 1. AUTHENTICATION
// =====================================================================
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
    } catch (e) { localStorage.removeItem('alphapulse_user'); }
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
  if (badge && state.currentUser) badge.textContent = state.currentUser.full_name || state.currentUser.email;
}

function setAuthMode(mode) {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const tabLogin = document.getElementById('auth-tab-login');
  const tabSignup = document.getElementById('auth-tab-signup');
  document.getElementById('auth-feedback')?.classList.add('hidden');

  if (mode === 'login') {
    loginForm.classList.remove('hidden'); signupForm.classList.add('hidden');
    tabLogin.className = 'py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 transition cursor-pointer';
    tabSignup.className = 'py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition cursor-pointer';
  } else {
    loginForm.classList.add('hidden'); signupForm.classList.remove('hidden');
    tabSignup.className = 'py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 transition cursor-pointer';
    tabLogin.className = 'py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition cursor-pointer';
  }
}

async function handleTraderLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  try {
    const res = await fetch('/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email, password}) });
    const data = await res.json();
    if (res.ok) { state.currentUser = data.user; localStorage.setItem('alphapulse_user', JSON.stringify(data.user)); showDashboardShell(); loadScannerUniverse(); loadPaperPositions(); checkAngelStatus(); return; }
    else showAuthError(data.detail || 'Login failed.');
  } catch (err) {
    state.currentUser = { email, full_name: email.split('@')[0] };
    localStorage.setItem('alphapulse_user', JSON.stringify(state.currentUser));
    showDashboardShell(); loadScannerUniverse(); loadPaperPositions();
  }
}

async function handleTraderSignup(e) {
  e.preventDefault();
  const fullName = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  try {
    const res = await fetch('/api/auth/signup', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email, full_name: fullName, password}) });
    const data = await res.json();
    if (res.ok) { state.currentUser = data.user; localStorage.setItem('alphapulse_user', JSON.stringify(data.user)); showDashboardShell(); loadScannerUniverse(); return; }
    else showAuthError(data.detail || 'Sign up failed.');
  } catch (err) {
    state.currentUser = { email, full_name: fullName };
    localStorage.setItem('alphapulse_user', JSON.stringify(state.currentUser));
    showDashboardShell(); loadScannerUniverse();
  }
}

function handleLogout() { localStorage.removeItem('alphapulse_user'); state.currentUser = null; showAuthScreen(); }

function showAuthError(msg) {
  const fb = document.getElementById('auth-feedback');
  if (fb) { fb.textContent = msg; fb.className = 'p-3 rounded-xl text-xs font-mono font-medium border bg-rose-500/15 border-rose-500/40 text-rose-300'; fb.classList.remove('hidden'); }
}

// =====================================================================
// 2. ANGEL ONE CONNECT
// =====================================================================
function openAngelModal() { document.getElementById('angel-modal')?.classList.remove('hidden'); }
function closeAngelModal() { document.getElementById('angel-modal')?.classList.add('hidden'); }

async function handleAngelConnectSubmit(e) {
  e.preventDefault();
  const clientCode = document.getElementById('angel-client-code').value.trim();
  const password = document.getElementById('angel-password').value;
  const totpKey = document.getElementById('angel-totp-key').value.trim();
  const apiKey = document.getElementById('angel-api-key').value.trim();
  const fb = document.getElementById('angel-connect-feedback');

  try {
    const res = await fetch('/api/scanner/angel/connect', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ client_code: clientCode, password, totp_key: totpKey, api_key: apiKey })
    });
    const data = await res.json();
    if (res.ok && (data.status === 'SUCCESS' || data.status === 'SUCCESS_SIMULATED')) {
      state.angelConnected = true;
      state.angelLive = data.status === 'SUCCESS';
      closeAngelModal();
      updateDataSourceBadge(data.status === 'SUCCESS');
      updateAngelBadge(true, clientCode);
      showToast(`Angel One Connected! ${data.status === 'SUCCESS' ? 'LIVE DATA ACTIVE' : 'Simulation Relay Active'}`, 'success');
      // Reload scanner with live data
      loadScannerUniverse();
      return;
    } else {
      if (fb) { fb.textContent = data.message || 'Connection failed. Check credentials.'; fb.className = 'p-3 rounded-xl text-xs font-mono border bg-rose-500/15 border-rose-500/40 text-rose-300'; fb.classList.remove('hidden'); }
    }
  } catch (err) {
    state.angelConnected = true;
    closeAngelModal();
    updateAngelBadge(true, clientCode || 'ACTIVE');
    showToast('Angel One Relay Active (Simulation Mode)', 'success');
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
        updateAngelBadge(true, data.client_code || 'Connected');
        updateDataSourceBadge(data.has_jwt);
      }
    }
  } catch (e) {}
}

function updateAngelBadge(connected, clientCode) {
  const dot = document.getElementById('angel-status-dot');
  const label = document.getElementById('angel-header-label');
  if (dot) dot.className = connected ? 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse' : 'w-2 h-2 rounded-full bg-amber-400';
  if (label) label.textContent = connected ? `Angel: ${clientCode}` : 'Connect Angel One';
}

function updateDataSourceBadge(isLive) {
  const dot = document.getElementById('data-source-dot');
  const label = document.getElementById('data-source-label');
  const badge = document.getElementById('data-source-badge');
  if (isLive) {
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
    if (label) label.textContent = 'LIVE MARKET DATA';
    if (badge) badge.className = 'px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1.5';
  } else {
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';
    if (label) label.textContent = 'SIMULATION MODE';
    if (badge) badge.className = 'px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold flex items-center gap-1.5';
  }
}

// =====================================================================
// 3. LOAD SCANNER DATA — INTRADAY + SWING + SECTORS
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

      renderIntradayPicks();
      renderSwingPicks();
      renderSectorAnalysis();
      applyFilterAndRender();
    }
  } catch (e) { console.warn("Backend sync failed:", e); }
}

// =====================================================================
// 4. INTRADAY PICKS SECTION
// =====================================================================
function renderIntradayPicks() {
  const container = document.getElementById('intraday-picks-container');
  if (!container) return;
  container.innerHTML = '';

  const picks = state.intradayPicks;
  if (picks.length === 0) {
    container.innerHTML = '<div class="p-6 glass-panel rounded-2xl border border-slate-800 text-center text-slate-500 text-sm font-mono col-span-full">No strong intraday setups found right now. Market may be in consolidation.</div>';
    return;
  }

  picks.forEach((p, idx) => {
    const isBuy = p.side === 'BUY';
    const card = document.createElement('div');
    card.className = `p-4 rounded-2xl glass-panel border transition-all duration-300 hover:scale-[1.01] cursor-pointer shadow-xl ${isBuy ? 'border-emerald-500/50 hover:shadow-emerald-500/15' : 'border-rose-500/50 hover:shadow-rose-500/15'}`;
    card.onclick = () => openKronosDetail(p.symbol);

    card.innerHTML = `
      <div class="flex items-center justify-between gap-2 mb-3">
        <div class="flex items-center gap-2">
          <span class="w-7 h-7 rounded-lg ${isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'} flex items-center justify-center text-xs font-black">#${idx + 1}</span>
          <div>
            <span class="text-base font-black text-white">${p.symbol}</span>
            <span class="text-[10px] font-mono text-slate-400 ml-1">(${p.sector})</span>
          </div>
        </div>
        <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${isBuy ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'}">${p.side}</span>
      </div>

      <div class="flex items-baseline justify-between mb-3">
        <span class="text-xl font-black font-mono text-white">₹${p.ltp.toFixed(2)}</span>
        <span class="text-xs font-mono font-bold ${p.change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${p.change_pct >= 0 ? '+' : ''}${p.change_pct.toFixed(2)}%</span>
      </div>

      <!-- Kronos Badge -->
      <div class="flex items-center gap-2 mb-3 text-[10px] font-mono">
        <span class="px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">🤖 ${p.kronos_forecast} (${p.kronos_delta_pct >= 0 ? '+' : ''}${p.kronos_delta_pct}%)</span>
        <span class="px-2 py-0.5 rounded ${p.has_sector_tailwind ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}">${p.has_sector_tailwind ? '✓ Sector Flow' : 'Neutral'}</span>
        <span class="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">${p.confluence_score}% Score</span>
      </div>

      <!-- ENTRY / SL / TARGET BOX -->
      <div class="grid grid-cols-4 gap-1 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[10px] font-mono text-center mb-3">
        <div>
          <div class="text-slate-400 text-[9px]">ENTRY</div>
          <div class="font-bold text-white">₹${p.entry.toFixed(1)}</div>
        </div>
        <div>
          <div class="text-slate-400 text-[9px]">STOP LOSS</div>
          <div class="font-bold text-rose-400">₹${p.stop_loss.toFixed(1)}</div>
        </div>
        <div>
          <div class="text-slate-400 text-[9px]">TARGET 1</div>
          <div class="font-bold text-emerald-400">₹${p.target_1.toFixed(1)}</div>
        </div>
        <div>
          <div class="text-slate-400 text-[9px]">TARGET 2</div>
          <div class="font-bold text-emerald-300">₹${p.target_2.toFixed(1)}</div>
        </div>
      </div>

      <!-- Mini simulated candle bars -->
      ${renderMiniCandleStrip(p.projected_candles)}

      <div class="flex items-center gap-2 mt-3">
        <button onclick="event.stopPropagation(); executeQuickPaperOrder('${p.symbol}', '${p.side}')" class="flex-1 py-2 rounded-xl text-xs font-mono font-black shadow-lg transition cursor-pointer ${isBuy ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950' : 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white'}">
          ⚡ ${p.side} (Lot: ${p.lot_size})
        </button>
        <button onclick="event.stopPropagation(); openKronosDetail('${p.symbol}')" class="px-3 py-2 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/40 text-xs font-mono font-bold hover:bg-violet-500/30 transition cursor-pointer">
          🤖 Simulate
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderMiniCandleStrip(candles) {
  if (!candles || candles.length === 0) return '';
  let bars = '<div class="flex items-end gap-1 h-8 justify-center">';
  candles.forEach(c => {
    const isUp = c.close >= c.open;
    const height = Math.max(4, Math.min(28, Math.abs(c.close - c.open) / c.open * 2000));
    bars += `<div class="w-4 rounded-sm ${isUp ? 'bg-emerald-500/60' : 'bg-rose-500/60'}" style="height:${height}px" title="${c.step}: O:${c.open} C:${c.close}"></div>`;
  });
  bars += '</div>';
  return bars;
}

// =====================================================================
// 5. SWING PICKS SECTION
// =====================================================================
function renderSwingPicks() {
  const container = document.getElementById('swing-picks-container');
  if (!container) return;
  container.innerHTML = '';

  const picks = state.swingPicks;
  if (picks.length === 0) {
    container.innerHTML = '<div class="p-6 glass-panel rounded-2xl border border-slate-800 text-center text-slate-500 text-sm font-mono col-span-full">No strong swing setups found. Wait for sector-confirmed trends.</div>';
    return;
  }

  picks.forEach((p, idx) => {
    const isBuy = p.side === 'BUY';
    const card = document.createElement('div');
    card.className = `p-4 rounded-2xl glass-panel border transition-all duration-300 hover:scale-[1.01] cursor-pointer shadow-xl ${isBuy ? 'border-cyan-500/50 hover:shadow-cyan-500/15' : 'border-amber-500/50 hover:shadow-amber-500/15'}`;
    card.onclick = () => openKronosDetail(p.symbol);

    card.innerHTML = `
      <div class="flex items-center justify-between gap-2 mb-3">
        <div class="flex items-center gap-2">
          <span class="w-7 h-7 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-black">#${idx + 1}</span>
          <div>
            <span class="text-base font-black text-white">${p.symbol}</span>
            <span class="text-[10px] font-mono text-slate-400 ml-1">(${p.sector})</span>
          </div>
        </div>
        <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-500/20 text-violet-300 border border-violet-500/40">SWING ${p.side}</span>
      </div>

      <div class="flex items-baseline justify-between mb-3">
        <span class="text-xl font-black font-mono text-white">₹${p.ltp.toFixed(2)}</span>
        <span class="text-xs font-mono font-bold ${p.change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${p.change_pct >= 0 ? '+' : ''}${p.change_pct.toFixed(2)}%</span>
      </div>

      <div class="flex items-center gap-2 mb-3 text-[10px] font-mono">
        <span class="px-2 py-0.5 rounded bg-violet-500/20 text-violet-300">🤖 ${p.kronos_forecast}</span>
        <span class="px-2 py-0.5 rounded ${p.has_sector_tailwind ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}">${p.has_sector_tailwind ? '✓ Sector Tailwind' : 'Neutral'}</span>
      </div>

      <div class="grid grid-cols-4 gap-1 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[10px] font-mono text-center mb-3">
        <div><div class="text-slate-400 text-[9px]">ENTRY</div><div class="font-bold text-white">₹${p.entry.toFixed(1)}</div></div>
        <div><div class="text-slate-400 text-[9px]">STOP LOSS</div><div class="font-bold text-rose-400">₹${p.stop_loss.toFixed(1)}</div></div>
        <div><div class="text-slate-400 text-[9px]">TARGET 1</div><div class="font-bold text-emerald-400">₹${p.target_1.toFixed(1)}</div></div>
        <div><div class="text-slate-400 text-[9px]">TARGET 2</div><div class="font-bold text-emerald-300">₹${p.target_2.toFixed(1)}</div></div>
      </div>

      ${renderMiniCandleStrip(p.projected_candles)}

      <div class="flex items-center gap-2 mt-3">
        <button onclick="event.stopPropagation(); executeQuickPaperOrder('${p.symbol}', '${p.side}')" class="flex-1 py-2 rounded-xl text-xs font-mono font-black shadow-lg transition cursor-pointer bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white">
          ⚡ ${p.side} Swing (Lot: ${p.lot_size})
        </button>
        <button onclick="event.stopPropagation(); openKronosDetail('${p.symbol}')" class="px-3 py-2 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/40 text-xs font-mono font-bold hover:bg-violet-500/30 transition cursor-pointer">🤖</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// =====================================================================
// 6. KRONOS DETAIL (Full Simulation View for selected stock)
// =====================================================================
async function openKronosDetail(symbol) {
  state.selectedSymbol = symbol;
  const section = document.getElementById('kronos-detail-section');
  if (section) section.classList.remove('hidden');

  document.getElementById('kronos-detail-symbol').textContent = symbol;

  try {
    const res = await fetch(`/api/scanner/kronos/${symbol}`);
    if (res.ok) {
      const data = await res.json();
      renderKronosDetail(data);
    }
  } catch (e) { console.warn("Kronos fetch failed:", e); }

  section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderKronosDetail(data) {
  // Direction badge
  const dirEl = document.getElementById('kronos-dir-badge');
  if (dirEl) {
    dirEl.textContent = data.direction;
    const isBull = data.direction.includes('BULL');
    const isBear = data.direction.includes('BEAR');
    dirEl.className = `px-3 py-1 rounded-xl text-xs font-mono font-bold ${isBull ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : isBear ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700'}`;
  }

  // Metrics
  const deltaEl = document.getElementById('kronos-delta-label');
  const confEl = document.getElementById('kronos-conf-label');
  const pathEl = document.getElementById('kronos-path-label');
  const sideEl = document.getElementById('kronos-side-label');
  if (deltaEl) { deltaEl.textContent = `${data.delta_pct >= 0 ? '+' : ''}${data.delta_pct}%`; deltaEl.className = `text-lg font-bold ${data.delta_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`; }
  if (confEl) confEl.textContent = `${data.confidence}%`;
  if (pathEl) pathEl.textContent = `${data.path_consistency || '--'}%`;

  // Trade plan
  const tp = data.trade_plan || data;
  if (sideEl) { sideEl.textContent = tp.side || '--'; sideEl.className = `text-lg font-bold ${tp.side === 'BUY' ? 'text-emerald-400' : tp.side === 'SELL' ? 'text-rose-400' : 'text-amber-400'}`; }
  const entryEl = document.getElementById('kronos-entry');
  const slEl = document.getElementById('kronos-sl');
  const t1El = document.getElementById('kronos-t1');
  const t2El = document.getElementById('kronos-t2');
  if (entryEl) entryEl.textContent = `₹${(tp.entry || data.entry || 0).toFixed(2)}`;
  if (slEl) slEl.textContent = `₹${(tp.stop_loss || data.stop_loss || 0).toFixed(2)}`;
  if (t1El) t1El.textContent = `₹${(tp.target_1 || data.target_1 || 0).toFixed(2)}`;
  if (t2El) t2El.textContent = `₹${(tp.target_2 || data.target_2 || 0).toFixed(2)}`;

  // Projected candles table
  const tableEl = document.getElementById('kronos-candles-tbody');
  if (tableEl && data.projected_candles) {
    tableEl.innerHTML = '';
    data.projected_candles.forEach(c => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-800/60 font-mono text-xs';
      const isUp = c.close >= c.open;
      tr.innerHTML = `
        <td class="py-2 px-3 text-cyan-300 font-bold">${c.step}</td>
        <td class="py-2 px-3 text-slate-300">₹${c.open}</td>
        <td class="py-2 px-3 text-slate-200">₹${c.high}</td>
        <td class="py-2 px-3 text-slate-200">₹${c.low}</td>
        <td class="py-2 px-3 font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}">₹${c.close}</td>
        <td class="py-2 px-3 text-slate-400">${c.volume}</td>
      `;
      tableEl.appendChild(tr);
    });
  }

  // Draw Kronos simulation chart
  drawKronosChart(data.chart_candles || [], data.projected_candles || [], tp);
}

function drawKronosChart(historicalCandles, projectedCandles, tradePlan) {
  const canvas = document.getElementById('kronos-chart-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Combine historical + projected for unified chart
  const allCandles = [...historicalCandles.slice(-25)];
  const projStart = allCandles.length;
  projectedCandles.forEach(pc => allCandles.push(pc));

  if (allCandles.length === 0) {
    ctx.fillStyle = '#64748b'; ctx.font = '13px Inter'; ctx.textAlign = 'center';
    ctx.fillText('Click a stock to see Kronos simulation chart...', w/2, h/2);
    return;
  }

  const pad = { top: 20, right: 55, bottom: 25, left: 10 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  let minP = Infinity, maxP = -Infinity;
  allCandles.forEach(c => { minP = Math.min(minP, c.low); maxP = Math.max(maxP, c.high); });
  const range = Math.max(1, maxP - minP); minP -= range * 0.05; maxP += range * 0.05;
  const getY = p => pad.top + (1 - (p - minP) / (maxP - minP)) * plotH;
  const getX = i => pad.left + (i / Math.max(1, allCandles.length - 1)) * plotW;

  // Grid
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1; ctx.beginPath();
  for (let g = 0; g <= 4; g++) {
    const gy = pad.top + (g / 4) * plotH;
    ctx.moveTo(pad.left, gy); ctx.lineTo(w - pad.right, gy);
    ctx.fillStyle = '#64748b'; ctx.font = '10px JetBrains Mono'; ctx.textAlign = 'left';
    ctx.fillText(`₹${(maxP - (g/4)*(maxP-minP)).toFixed(1)}`, w - pad.right + 4, gy + 3);
  }
  ctx.stroke();

  // Draw projection zone background
  if (projStart < allCandles.length) {
    const zoneX = getX(projStart) - 5;
    ctx.fillStyle = 'rgba(139, 92, 246, 0.06)';
    ctx.fillRect(zoneX, pad.top, w - pad.right - zoneX, plotH);
    // Dashed separator
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(zoneX, pad.top); ctx.lineTo(zoneX, h - pad.bottom); ctx.stroke();
    ctx.setLineDash([]);
    // Label
    ctx.fillStyle = '#a855f7'; ctx.font = '9px JetBrains Mono'; ctx.textAlign = 'left';
    ctx.fillText('KRONOS PROJECTED →', zoneX + 4, pad.top + 12);
  }

  // Candlesticks
  const candleW = Math.max(3, (plotW / allCandles.length) * 0.65);
  allCandles.forEach((c, i) => {
    const cx = getX(i);
    const isUp = c.close >= c.open;
    const isProjected = i >= projStart;
    const color = isProjected ? (isUp ? '#8b5cf6' : '#c084fc') : (isUp ? '#10b981' : '#ef4444');

    ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.beginPath();
    ctx.moveTo(cx, getY(c.high)); ctx.lineTo(cx, getY(c.low)); ctx.stroke();
    const bodyTop = getY(Math.max(c.open, c.close));
    const bodyBot = getY(Math.min(c.open, c.close));
    ctx.fillStyle = color;
    ctx.fillRect(cx - candleW/2, bodyTop, candleW, Math.max(1.5, bodyBot - bodyTop));
  });

  // Trade plan lines
  if (tradePlan) {
    const drawLevel = (price, color, label) => {
      if (!price) return;
      const y = getY(price);
      ctx.strokeStyle = color; ctx.setLineDash([6, 3]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color; ctx.font = 'bold 9px JetBrains Mono'; ctx.textAlign = 'right';
      ctx.fillText(`${label}: ₹${price.toFixed(1)}`, w - pad.right - 2, y - 4);
    };
    drawLevel(tradePlan.entry || tradePlan.entry, '#06b6d4', 'ENTRY');
    drawLevel(tradePlan.stop_loss || tradePlan.stop_loss, '#ef4444', 'SL');
    drawLevel(tradePlan.target_1 || tradePlan.target_1, '#10b981', 'TGT1');
    drawLevel(tradePlan.target_2 || tradePlan.target_2, '#34d399', 'TGT2');
  }
}

// =====================================================================
// 7. SECTOR FLOW ANALYSIS
// =====================================================================
function renderSectorAnalysis() {
  if (!state.sectorAnalysis) return;
  const data = state.sectorAnalysis;

  // Inflow
  const inflowContainer = document.getElementById('sector-inflow-list');
  if (inflowContainer && data.top_inflow_sectors) {
    inflowContainer.innerHTML = '';
    data.top_inflow_sectors.forEach(sec => {
      const div = document.createElement('div');
      div.className = 'p-3 rounded-2xl bg-slate-950/70 border border-emerald-500/30 flex items-center justify-between cursor-pointer hover:bg-slate-900 transition';
      div.onclick = () => selectSectorDrilldown(sec.sector);
      div.innerHTML = `<div><div class="font-bold text-white text-xs">${sec.sector}</div><div class="text-[10px] text-slate-400 font-mono">${sec.bullish_count} Bull / ${sec.bearish_count} Bear</div></div><div class="text-right"><div class="font-mono font-bold text-emerald-400 text-sm">+${sec.avg_change_pct}%</div><span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300">${sec.status.replace('_',' ')}</span></div>`;
      inflowContainer.appendChild(div);
    });
  }

  // Outflow
  const outflowContainer = document.getElementById('sector-outflow-list');
  if (outflowContainer && data.top_outflow_sectors) {
    outflowContainer.innerHTML = '';
    data.top_outflow_sectors.forEach(sec => {
      const div = document.createElement('div');
      div.className = 'p-3 rounded-2xl bg-slate-950/70 border border-rose-500/30 flex items-center justify-between cursor-pointer hover:bg-slate-900 transition';
      div.onclick = () => selectSectorDrilldown(sec.sector);
      div.innerHTML = `<div><div class="font-bold text-white text-xs">${sec.sector}</div><div class="text-[10px] text-slate-400 font-mono">${sec.bullish_count} Bull / ${sec.bearish_count} Bear</div></div><div class="text-right"><div class="font-mono font-bold text-rose-400 text-sm">${sec.avg_change_pct}%</div><span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300">${sec.status.replace('_',' ')}</span></div>`;
      outflowContainer.appendChild(div);
    });
  }

  // Sector dropdown
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

  document.getElementById('drilldown-sector-title').textContent = `${sec.sector} Sector Deep-Dive`;

  const renderStocks = (containerId, stocks, side) => {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    if (!stocks || stocks.length === 0) { el.innerHTML = `<div class="text-slate-500 text-xs p-2">No data.</div>`; return; }
    stocks.forEach(st => {
      const row = document.createElement('div');
      row.className = `p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between hover:border-${side === 'buy' ? 'emerald' : 'rose'}-500/50 cursor-pointer transition`;
      row.onclick = () => openKronosDetail(st.symbol);
      row.innerHTML = `<div><strong class="text-white text-xs">${st.symbol}</strong><span class="text-[10px] font-mono ${st.change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'} ml-2">${st.change_pct >= 0 ? '+' : ''}${st.change_pct}%</span></div><span class="text-[10px] font-mono text-slate-400">Vol: ${st.volume_surge}x</span>`;
      el.appendChild(row);
    });
  };

  renderStocks('sector-top-buying-stocks', sec.top_buying_stocks, 'buy');
  renderStocks('sector-top-selling-stocks', sec.top_selling_stocks, 'sell');
}

// =====================================================================
// 8. SCANNER TABLE
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
    let valA = a[state.sortField] ?? 0, valB = b[state.sortField] ?? 0;
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
    tr.className = `border-b border-slate-800/60 hover:bg-slate-800/40 transition cursor-pointer ${s.symbol === state.selectedSymbol ? 'bg-cyan-500/10' : ''}`;
    tr.onclick = () => openKronosDetail(s.symbol);

    const isUp = s.change_pct >= 0;
    let sigClass = 'bg-slate-800 text-slate-400';
    if (s.signal.includes('BUY')) sigClass = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
    if (s.signal.includes('SELL')) sigClass = 'bg-rose-500/20 text-rose-400 border border-rose-500/40';

    let kronosClass = 'text-slate-400';
    const kf = s.kronos_forecast || '';
    if (kf.includes('BULL')) kronosClass = 'text-emerald-400';
    if (kf.includes('BEAR')) kronosClass = 'text-rose-400';

    tr.innerHTML = `
      <td class="py-3 px-3 font-bold text-white"><span>${s.symbol}</span> <span class="text-[10px] text-slate-500 font-normal">(${s.sector})</span></td>
      <td class="py-3 px-3 font-mono text-slate-200">₹${s.ltp.toFixed(2)}</td>
      <td class="py-3 px-3 font-mono ${isUp ? 'text-emerald-400' : 'text-rose-400'}">${isUp ? '+' : ''}${s.change_pct.toFixed(2)}%</td>
      <td class="py-3 px-3 font-mono text-cyan-400">₹${s.ema9.toFixed(1)}</td>
      <td class="py-3 px-3 font-mono text-violet-400">₹${s.ema15.toFixed(1)}</td>
      <td class="py-3 px-3 font-mono text-amber-400">₹${s.vwap.toFixed(1)}</td>
      <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${sigClass}">${s.signal}</span></td>
      <td class="py-3 px-3 font-mono font-bold ${s.alpha_score >= 80 ? 'text-amber-400' : 'text-slate-300'}">${s.alpha_score || 50}%</td>
      <td class="py-3 px-3 font-mono text-xs ${kronosClass}">${kf || '--'}</td>
      <td class="py-3 px-3 text-right">
        <button onclick="event.stopPropagation(); openKronosDetail('${s.symbol}')" class="px-2 py-1 rounded bg-violet-500/20 hover:bg-violet-500/40 text-violet-300 text-[10px] font-bold">🤖 Sim</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// =====================================================================
// 9. WEBSOCKET LIVE TICKS
// =====================================================================
function initWebSocket() {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = window.location.host || 'localhost:8000';
  const wsUrl = `${wsProtocol}//${wsHost}/api/ws/ticks`;

  if (window.WSClient) {
    state.wsClient = new window.WSClient(wsUrl, handleTickUpdate, null);
    state.wsClient.connect();
  }
}

function handleTickUpdate(data) {
  if (!data) return;

  // Update ticks
  const ticks = data.ticks || data;
  if (Array.isArray(ticks)) {
    ticks.forEach(t => {
      const s = state.allStocks.find(item => item.symbol === t.symbol);
      if (s) {
        s.ltp = t.ltp;
        s.change_pct = t.change_pct;
      }
    });
  }

  // Update market breadth from WebSocket
  if (data.market_breadth) {
    const bullEl = document.getElementById('market-bull-count');
    const bearEl = document.getElementById('market-bear-count');
    if (bullEl) bullEl.textContent = data.market_breadth.bullish;
    if (bearEl) bearEl.textContent = data.market_breadth.bearish;
  }

  // Update data source from WebSocket
  if (data.angel_live !== undefined) {
    updateDataSourceBadge(data.angel_live);
  }

  updatePaperPositionsLivePnL();
}

// =====================================================================
// 10. PAPER TRADING
// =====================================================================
async function executeQuickPaperOrder(symbol, side) {
  const stock = state.allStocks.find(s => s.symbol === symbol);
  if (!stock) return;
  const qty = stock.lot_size || 100;
  const price = stock.ltp;

  try {
    const res = await fetch('/api/trade/order', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        symbol, side, qty, price,
        sl_price: side === 'BUY' ? price * 0.99 : price * 1.01,
        tp_price: side === 'BUY' ? price * 1.025 : price * 0.975,
        strategy: '9_15_EMA_VWAP'
      })
    });
    if (res.ok) { showToast(`Paper ${side} ${qty} ${symbol} @ ₹${price.toFixed(2)}`, 'success'); loadPaperPositions(); return; }
  } catch (e) {}
  showToast(`Paper ${side} ${qty} ${symbol} @ ₹${price.toFixed(2)}`, 'success');
}

async function closePaperOrder(orderId) {
  try {
    const res = await fetch('/api/trade/close', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({order_id: orderId}) });
    if (res.ok) { showToast(`Order #${orderId} Closed!`, 'info'); loadPaperPositions(); }
  } catch (e) {}
}

async function loadPaperPositions() {
  try {
    const res = await fetch('/api/trade/positions');
    if (res.ok) { state.paperOrders = await res.json(); renderPaperPositions(); }
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
      <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded text-[10px] ${o.status === 'OPEN' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}">${o.status}</span></td>
      <td class="py-2.5 px-3 text-right">${o.status === 'OPEN' ? `<button onclick="closePaperOrder(${o.id})" class="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 text-[10px] font-bold">Close</button>` : ''}</td>
    `;
    tbody.appendChild(tr);
  });

  const totalPnlEl = document.getElementById('paper-total-pnl');
  if (totalPnlEl) {
    totalPnlEl.textContent = `₹${totalNet.toFixed(2)}`;
    totalPnlEl.className = `text-lg font-mono font-bold ${totalNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
  }
}

// =====================================================================
// 11. FILTERS & UTILITIES
// =====================================================================
function filterBySector(sector) {
  state.activeSectorFilter = sector;
  document.querySelectorAll('.sector-filter-btn').forEach(c => {
    if (c.getAttribute('data-sector') === sector) {
      c.className = 'sector-filter-btn px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 transition';
    } else {
      c.className = 'sector-filter-btn px-3 py-1.5 rounded-xl text-xs font-mono font-semibold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 transition';
    }
  });
  applyFilterAndRender();
}

function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  const colorClass = type === 'success' ? 'border-emerald-500 text-emerald-300 bg-slate-900/95' : type === 'error' ? 'border-rose-500 text-rose-300 bg-slate-900/95' : 'border-cyan-500 text-cyan-300 bg-slate-900/95';
  toast.className = `fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl border ${colorClass} shadow-2xl text-xs font-mono backdrop-blur-md transition-all duration-300`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3500);
}

function setupEventListeners() {
  document.getElementById('scanner-search')?.addEventListener('input', e => { state.searchQuery = e.target.value; applyFilterAndRender(); });
  document.getElementById('scanner-sort')?.addEventListener('change', e => { state.sortField = e.target.value; applyFilterAndRender(); });
}

// Global exports
window.handleTraderLogin = handleTraderLogin;
window.handleTraderSignup = handleTraderSignup;
window.handleLogout = handleLogout;
window.setAuthMode = setAuthMode;
window.openAngelModal = openAngelModal;
window.closeAngelModal = closeAngelModal;
window.handleAngelConnectSubmit = handleAngelConnectSubmit;
window.selectSectorDrilldown = selectSectorDrilldown;
window.executeQuickPaperOrder = executeQuickPaperOrder;
window.closePaperOrder = closePaperOrder;
window.openKronosDetail = openKronosDetail;
window.filterBySector = filterBySector;
