/* ============================================================================
   FARTTRACKER.JS — LIVE FART STATISTICS TRACKER
   ============================================================================
   Tracks every fart emitted during a level and provides:
     • Live side-panel meters that update in real-time while farting
       (loudness, length, smelliness)
     • Per-level high scores for each stat
     • Rank of the last fart vs. the session bests
     • Post-level summary: full fart log + NPCs that smelled/heard each

   HOW TO USE:
     FART_TRACKER.startLevel()       — reset tracker for a new level
     FART_TRACKER.onFartStart(data)  — called when a hold/release begins
     FART_TRACKER.onFartEnd(data)    — called on button-up/release
     FART_TRACKER.tick(dt, data)     — called each game frame while farting
     FART_TRACKER.onNpcDetected(npcId, source) — record NPC reactions
     FART_TRACKER.endLevel(success)  — finalize, return summary
     FART_TRACKER.getSidePanelEl()   — returns the side panel DOM element
   ============================================================================ */

const FART_TRACKER = (() => {
  // ── State ────────────────────────────────────────────────────────────────
  let farts = [];          // complete log for this level
  let currentFart = null;  // the fart currently in progress (null when not farting)
  let sessionBests = { loudness: 0, length: 0, smell: 0 };
  let panelEl = null;
  let tickTimer = 0;

  // ── DOM panel creation ───────────────────────────────────────────────────
  function buildPanel() {
    if (panelEl) { panelEl.remove(); panelEl = null; }

    const panel = document.createElement('div');
    panel.id = 'fart-tracker-panel';
    panel.innerHTML = `
      <div class="ftp-header">💨 Fart Meter</div>

      <div class="ftp-section ftp-live">
        <div class="ftp-section-title">LIVE</div>

        <div class="ftp-stat">
          <div class="ftp-stat-row">
            <span class="ftp-stat-icon">🔊</span>
            <span class="ftp-stat-label">Loud</span>
            <span class="ftp-stat-val" id="ftp-live-loud">—</span>
          </div>
          <div class="ftp-bar-bg"><div class="ftp-bar-fill ftp-bar-loud" id="ftp-bar-loud" style="width:0%"></div></div>
        </div>

        <div class="ftp-stat">
          <div class="ftp-stat-row">
            <span class="ftp-stat-icon">⏱</span>
            <span class="ftp-stat-label">Length</span>
            <span class="ftp-stat-val" id="ftp-live-len">—</span>
          </div>
          <div class="ftp-bar-bg"><div class="ftp-bar-fill ftp-bar-len" id="ftp-bar-len" style="width:0%"></div></div>
        </div>

        <div class="ftp-stat">
          <div class="ftp-stat-row">
            <span class="ftp-stat-icon">💀</span>
            <span class="ftp-stat-label">Smell</span>
            <span class="ftp-stat-val" id="ftp-live-smell">—</span>
          </div>
          <div class="ftp-bar-bg"><div class="ftp-bar-fill ftp-bar-smell" id="ftp-bar-smell" style="width:0%"></div></div>
        </div>
      </div>

      <div class="ftp-section ftp-bests">
        <div class="ftp-section-title">SESSION BEST</div>
        <div class="ftp-mini-row"><span>🔊</span><span id="ftp-best-loud">—</span></div>
        <div class="ftp-mini-row"><span>⏱</span><span id="ftp-best-len">—</span></div>
        <div class="ftp-mini-row"><span>💀</span><span id="ftp-best-smell">—</span></div>
      </div>

      <div class="ftp-section ftp-rank" id="ftp-rank-section" style="display:none">
        <div class="ftp-section-title">LAST FART RANK</div>
        <div id="ftp-rank-content"></div>
      </div>

      <div class="ftp-section ftp-count">
        <div class="ftp-mini-row"><span>💨 Farts</span><span id="ftp-count">0</span></div>
        <div class="ftp-mini-row"><span>👃 NPCs hit</span><span id="ftp-npcs">0</span></div>
      </div>
    `;

    // Inject CSS into head if not already there
    if (!document.getElementById('ftp-styles')) {
      const style = document.createElement('style');
      style.id = 'ftp-styles';
      style.textContent = `
        #fart-tracker-panel {
          position: fixed;
          right: 12px;
          top: 60px;
          width: 148px;
          background: var(--card-bg, #fff);
          border: 1.5px solid var(--border-soft, rgba(46,33,56,0.15));
          border-radius: 14px;
          padding: 10px 10px 12px;
          z-index: 8888;
          font-family: var(--font-body, 'Nunito Sans', sans-serif);
          font-size: 11px;
          box-shadow: 0 4px 18px rgba(0,0,0,0.18);
          display: none;
          flex-direction: column;
          gap: 8px;
          color: var(--ink, #2E2138);
        }
        #fart-tracker-panel.ftp-visible { display: flex; }
        .ftp-header {
          font-family: var(--font-display, 'Baloo 2', sans-serif);
          font-weight: 700;
          font-size: 13px;
          text-align: center;
          color: var(--accent, #E75480);
          padding-bottom: 4px;
          border-bottom: 1px solid var(--border-soft, rgba(46,33,56,0.12));
        }
        .ftp-section { display: flex; flex-direction: column; gap: 5px; }
        .ftp-section-title {
          font-size: 8.5px;
          font-weight: 800;
          letter-spacing: 0.8px;
          color: var(--ink-soft, #5C4F6B);
          text-transform: uppercase;
        }
        .ftp-stat { display: flex; flex-direction: column; gap: 2px; }
        .ftp-stat-row {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .ftp-stat-icon { font-size: 10px; flex-shrink: 0; }
        .ftp-stat-label { flex: 1; color: var(--ink-soft, #5C4F6B); font-size: 10px; }
        .ftp-stat-val { font-weight: 700; font-size: 10px; color: var(--ink, #2E2138); }
        .ftp-bar-bg {
          background: var(--card-bg-soft, #F3ECDD);
          border-radius: 99px;
          height: 5px;
          overflow: hidden;
        }
        .ftp-bar-fill {
          height: 5px;
          border-radius: 99px;
          transition: width 0.08s, background 0.2s;
        }
        .ftp-bar-loud { background: #5b8def; }
        .ftp-bar-len { background: #9FBF3B; }
        .ftp-bar-smell { background: #E75480; }
        .ftp-bar-loud.ftp-bar-high { background: #cc3b3b; }
        .ftp-bar-len.ftp-bar-high { background: #e8a020; }
        .ftp-bar-smell.ftp-bar-high { background: #cc2200; }
        .ftp-mini-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 10px;
          color: var(--ink, #2E2138);
        }
        .ftp-mini-row span:first-child { color: var(--ink-soft, #5C4F6B); }
        .ftp-rank-item {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          margin-bottom: 2px;
        }
        .ftp-rank-label { color: var(--ink-soft, #5C4F6B); }
        .ftp-rank-badge {
          font-weight: 800;
          padding: 0px 4px;
          border-radius: 4px;
          font-size: 9px;
        }
        .ftp-rank-pb { background: #9FBF3B22; color: #5a7a1a; }
        .ftp-rank-high { background: #5b8def22; color: #2a5fbf; }
        .ftp-rank-mid { background: #e8a02022; color: #a06010; }
        .ftp-rank-low { background: #88888822; color: #666; }
        body.dark-theme #fart-tracker-panel {
          background: var(--card-bg, #2a1f3d);
          color: var(--ink, #f0e8ff);
          border-color: rgba(200,180,230,0.2);
        }
        body.dark-theme .ftp-stat-val { color: var(--ink, #f0e8ff); }
        body.dark-theme .ftp-mini-row { color: var(--ink, #f0e8ff); }
        body.dark-theme .ftp-rank-pb { background: #9FBF3B33; color: #c5e060; }
        body.dark-theme .ftp-rank-high { background: #5b8def33; color: #9ab8ff; }
        body.dark-theme .ftp-rank-mid { background: #e8a02033; color: #f0c060; }
        body.dark-theme .ftp-rank-low { background: #88888833; color: #bbb; }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(panel);
    panelEl = panel;
    return panel;
  }

  function getPanelEl() { return panelEl; }

  function setVisible(v) {
    if (!panelEl) buildPanel();
    panelEl.classList.toggle('ftp-visible', !!v);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function fmt(v, unit = '') {
    if (v === null || v === undefined) return '—';
    return Math.round(v) + unit;
  }

  function fmtMs(ms) {
    if (!ms) return '—';
    if (ms < 1000) return ms + 'ms';
    return (ms / 1000).toFixed(1) + 's';
  }

  function totalNpcHits() {
    return farts.reduce((acc, f) => acc + f.npcsSmelled + f.npcsHeard, 0);
  }

  // ── Level lifecycle ───────────────────────────────────────────────────────
  function startLevel() {
    farts = [];
    currentFart = null;
    sessionBests = { loudness: 0, length: 0, smell: 0 };
    tickTimer = 0;
    if (!panelEl) buildPanel();
    setVisible(true);
    updatePanel();
  }

  // Called when the player starts holding (fart begins)
  function onFartStart(data) {
    // data: { smellLevel, loudLevel }
    currentFart = {
      id: farts.length + 1,
      startTime: performance.now(),
      durationMs: 0,
      peakLoudness: 0,   // 0-100
      smellScore: 0,     // 0-100
      power: 0,
      npcsSmelled: 0,
      npcsHeard: 0,
      isPuff: false,
    };
    // Seed smell from level smell level
    currentFart._smellLevel = (data && data.smellLevel) || 0.5;
    currentFart._loudLevel = (data && data.loudLevel) || 0.5;
  }

  // Called every game frame while a fart is active
  function tick(dt, data) {
    if (!currentFart) return;
    tickTimer += dt;

    currentFart.durationMs = performance.now() - currentFart.startTime;

    // power from 0..1 passed in by game.js via PLAYER.getHoldPower()
    const power = (data && data.power != null) ? data.power : 0;
    currentFart.power = power;
    currentFart.peakLoudness = Math.max(currentFart.peakLoudness, power * 100);
    // Smell accumulates over time × smell level
    currentFart.smellScore = Math.min(100,
      power * currentFart._smellLevel * 100 * 0.7 +
      (currentFart.durationMs / 5000) * currentFart._smellLevel * 100 * 0.3
    );

    // Only refresh panel DOM ~every 40ms to avoid thrashing
    if (tickTimer >= 40) {
      tickTimer = 0;
      updateLiveMeter();
    }
  }

  // Called when release finishes (button-up)
  function onFartEnd(data) {
    if (!currentFart) return;
    currentFart.durationMs = performance.now() - currentFart.startTime;
    currentFart.isPuff = (data && data.isPuff) || false;
    currentFart.power = (data && data.power) || currentFart.power;
    currentFart.peakLoudness = Math.max(currentFart.peakLoudness, currentFart.power * 100);
    currentFart.smellScore = Math.min(100,
      currentFart.power * currentFart._smellLevel * 100 * 0.7 +
      (currentFart.durationMs / 5000) * currentFart._smellLevel * 100 * 0.3
    );

    // Update session bests
    const prev = { ...sessionBests };
    sessionBests.loudness = Math.max(sessionBests.loudness, currentFart.peakLoudness);
    sessionBests.length   = Math.max(sessionBests.length, currentFart.durationMs);
    sessionBests.smell    = Math.max(sessionBests.smell, currentFart.smellScore);

    farts.push({ ...currentFart });
    const finished = farts[farts.length - 1];
    currentFart = null;

    updatePanel(finished, prev);
  }

  // Called from game.js whenever an NPC detects the player
  function onNpcDetected(npcId, source) {
    // Tag the current fart if it's still active; otherwise tag the last one
    const target = currentFart || (farts.length ? farts[farts.length - 1] : null);
    if (!target) return;
    if (source === 'smell') target.npcsSmelled = (target.npcsSmelled || 0) + 1;
    else target.npcsHeard = (target.npcsHeard || 0) + 1;
    updateCounters();
  }

  // ── DOM updates ───────────────────────────────────────────────────────────
  function el(id) { return panelEl ? panelEl.querySelector('#' + id) : null; }

  function updateLiveMeter() {
    if (!currentFart || !panelEl) return;
    const loud = currentFart.peakLoudness;
    const len  = Math.min(100, (currentFart.durationMs / 5000) * 100);
    const smell = currentFart.smellScore;

    const loudEl = el('ftp-live-loud');
    const lenEl  = el('ftp-live-len');
    const smellEl = el('ftp-live-smell');
    const loudBar = el('ftp-bar-loud');
    const lenBar  = el('ftp-bar-len');
    const smellBar = el('ftp-bar-smell');

    if (loudEl) loudEl.textContent = fmt(loud, '%');
    if (lenEl)  lenEl.textContent  = fmtMs(currentFart.durationMs);
    if (smellEl) smellEl.textContent = fmt(smell, '%');

    if (loudBar)  { loudBar.style.width = loud + '%'; loudBar.classList.toggle('ftp-bar-high', loud > 70); }
    if (lenBar)   { lenBar.style.width  = len + '%';  lenBar.classList.toggle('ftp-bar-high', len > 70); }
    if (smellBar) { smellBar.style.width = smell + '%'; smellBar.classList.toggle('ftp-bar-high', smell > 70); }
  }

  function updatePanel(lastFart, prevBests) {
    if (!panelEl) return;
    updateLiveMeter();

    // Bests
    const bestLoud  = el('ftp-best-loud');
    const bestLen   = el('ftp-best-len');
    const bestSmell = el('ftp-best-smell');
    if (bestLoud)  bestLoud.textContent  = sessionBests.loudness > 0 ? fmt(sessionBests.loudness, '%') : '—';
    if (bestLen)   bestLen.textContent   = sessionBests.length > 0   ? fmtMs(sessionBests.length) : '—';
    if (bestSmell) bestSmell.textContent = sessionBests.smell > 0    ? fmt(sessionBests.smell, '%') : '—';

    updateCounters();

    // Rank section
    if (lastFart) {
      const rankSection = el('ftp-rank-section');
      const rankContent = el('ftp-rank-content');
      if (rankSection) rankSection.style.display = '';
      if (rankContent && prevBests) {
        rankContent.innerHTML = buildRankHTML(lastFart, prevBests);
      }
    }

    // Reset live bars when no fart in progress
    if (!currentFart) {
      const loudEl = el('ftp-live-loud');
      const lenEl  = el('ftp-live-len');
      const smellEl = el('ftp-live-smell');
      const loudBar = el('ftp-bar-loud');
      const lenBar  = el('ftp-bar-len');
      const smellBar = el('ftp-bar-smell');
      if (loudEl) loudEl.textContent = '—';
      if (lenEl)  lenEl.textContent  = '—';
      if (smellEl) smellEl.textContent = '—';
      if (loudBar)  loudBar.style.width = '0%';
      if (lenBar)   lenBar.style.width  = '0%';
      if (smellBar) smellBar.style.width = '0%';
    }
  }

  function updateCounters() {
    const countEl = el('ftp-count');
    const npcsEl  = el('ftp-npcs');
    if (countEl) countEl.textContent = farts.length;
    if (npcsEl)  npcsEl.textContent  = totalNpcHits();
  }

  function buildRankHTML(fart, prevBests) {
    function rank(val, prev, unit, isMs) {
      const isNewBest = val > prev + 0.01;
      const pct = prev > 0 ? (val / prev) : 1;
      let cls, label;
      if (isNewBest) { cls = 'ftp-rank-pb'; label = '🏆 NEW BEST'; }
      else if (pct >= 0.9) { cls = 'ftp-rank-high'; label = 'Top'; }
      else if (pct >= 0.6) { cls = 'ftp-rank-mid'; label = 'Mid'; }
      else { cls = 'ftp-rank-low'; label = 'Low'; }
      const valStr = isMs ? fmtMs(val) : fmt(val, unit);
      return `<div class="ftp-rank-item"><span class="ftp-rank-label">${isMs ? '⏱' : unit === '%' ? '🔊' : '💀'} ${valStr}</span><span class="ftp-rank-badge ${cls}">${label}</span></div>`;
    }
    return rank(fart.peakLoudness, prevBests.loudness, '%', false) +
           rank(fart.durationMs,   prevBests.length,   'ms', true) +
           rank(fart.smellScore,   prevBests.smell,    '%', false);
  }

  // ── Post-level summary ────────────────────────────────────────────────────
  // Returns a structured summary object and also builds the HTML for the
  // level-complete/caught screen fart log section.
  function endLevel(success) {
    // Finalize any still-active fart
    if (currentFart) onFartEnd({ power: currentFart.power, isPuff: false });

    setVisible(false);

    const summary = {
      totalFarts: farts.length,
      totalNpcsHit: totalNpcHits(),
      sessionBests: { ...sessionBests },
      farts: farts.map(f => ({ ...f })),
    };
    return summary;
  }

  // Build the fart-log HTML for injection into level-complete/caught screens
  function buildSummaryHTML(summary) {
    if (!summary || summary.totalFarts === 0) {
      return '<div style="font-size:12px;color:var(--ink-soft);text-align:center;padding:8px">No farts recorded.</div>';
    }

    const rows = summary.farts.map((f, i) => {
      const npcStr = (f.npcsSmelled + f.npcsHeard) > 0
        ? `👃${f.npcsSmelled} 👂${f.npcsHeard}`
        : '—';
      return `<tr>
        <td style="text-align:center;font-weight:700;">#${i + 1}</td>
        <td style="text-align:center;">${fmt(f.peakLoudness, '%')}</td>
        <td style="text-align:center;">${fmtMs(f.durationMs)}</td>
        <td style="text-align:center;">${fmt(f.smellScore, '%')}</td>
        <td style="text-align:center;">${npcStr}</td>
      </tr>`;
    }).join('');

    return `
      <div class="ftp-summary-wrap">
        <div class="ftp-summary-title">💨 Fart Log (${summary.totalFarts} farts · ${summary.totalNpcsHit} NPCs affected)</div>
        <div class="ftp-summary-table-scroll">
          <table class="ftp-summary-table">
            <thead>
              <tr>
                <th>#</th><th>🔊 Loud</th><th>⏱ Length</th><th>💀 Smell</th><th>NPCs</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="ftp-summary-bests">
          <span>🏆 Best: 🔊${fmt(summary.sessionBests.loudness,'%')} · ⏱${fmtMs(summary.sessionBests.length)} · 💀${fmt(summary.sessionBests.smell,'%')}</span>
        </div>
      </div>`;
  }

  // Inject summary table styles once
  function injectSummaryStyles() {
    if (document.getElementById('ftp-summary-styles')) return;
    const s = document.createElement('style');
    s.id = 'ftp-summary-styles';
    s.textContent = `
      .ftp-summary-wrap {
        background: var(--card-bg-soft, #F3ECDD);
        border: 1px solid var(--border-soft);
        border-radius: 12px;
        padding: 10px 12px;
        margin-top: 10px;
      }
      .ftp-summary-title {
        font-family: var(--font-display, 'Baloo 2', sans-serif);
        font-weight: 700;
        font-size: 13px;
        color: var(--accent, #E75480);
        margin-bottom: 8px;
      }
      .ftp-summary-table-scroll { overflow-x: auto; }
      .ftp-summary-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
        color: var(--ink, #2E2138);
      }
      .ftp-summary-table th {
        font-weight: 700;
        padding: 4px 6px;
        border-bottom: 1.5px solid var(--border-soft);
        color: var(--ink-soft);
        white-space: nowrap;
      }
      .ftp-summary-table td {
        padding: 3px 6px;
        border-bottom: 1px solid var(--border-soft);
      }
      .ftp-summary-table tr:last-child td { border-bottom: none; }
      .ftp-summary-bests {
        font-size: 10.5px;
        font-weight: 700;
        color: var(--ink-soft);
        margin-top: 6px;
        text-align: center;
      }
    `;
    document.head.appendChild(s);
  }

  injectSummaryStyles();

  return {
    startLevel,
    onFartStart,
    onFartEnd,
    tick,
    onNpcDetected,
    endLevel,
    buildSummaryHTML,
    setVisible,
    getSidePanelEl: () => panelEl,
  };
})();
