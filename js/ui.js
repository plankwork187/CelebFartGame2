/* ============================================================================
   UI.JS — SCREEN MANAGEMENT
   ============================================================================
   Handles every non-gameplay screen: title, mode select, character select,
   custom mode setup form, story progress map, level intro (visual novel),
   and level complete. Gameplay itself (the #screen-game contents) is
   driven by game.js, not this file — ui.js just shows/hides that screen
   and wires up the buttons that lead into and out of it.

   All screen DOM is already in index.html; this file only toggles
   visibility and fills in dynamic content (text, images, generated
   lists) using the data from data.js / generator.js.
   ========================================================================= */

const UI = (() => {
  const screens = {};
  let onModeChosen = null;       // callback(modeId) set by main.js
  let onCharacterChosen = null;  // callback(characterId) set by main.js
  let onCustomStart = null;      // callback(customOptions) set by main.js
  let onLevelIntroDone = null;   // callback() set by game.js via main.js
  let onStoryContinue = null;
  let progress = null;           // reference to PROGRESS (set in init)

  function init(progressRef) {
    progress = progressRef;
    document.querySelectorAll('.screen').forEach(s => screens[s.id] = s);
    wireStaticButtons();
  }

  function showScreen(id) {
    Object.values(screens).forEach(s => s.classList.remove('screen-active'));
    screens[id].classList.add('screen-active');
    window.scrollTo(0, 0);
  }

  // ── Static navigation wiring (buttons that always do the same thing) ──
  function wireStaticButtons() {
    byId('btn-go-mode-select').onclick = () => showScreen('screen-mode-select');
    byId('btn-go-howto').onclick = () => showScreen('screen-howto');
    byId('btn-howto-back').onclick = () => showScreen('screen-title');
    byId('btn-mode-back').onclick = () => showScreen('screen-title');
    byId('btn-char-back').onclick = () => showScreen('screen-mode-select');
    byId('btn-custom-back').onclick = () => showScreen('screen-mode-select');
    byId('btn-story-back').onclick = () => showScreen('screen-mode-select');

    document.querySelectorAll('.mode-card').forEach(card => {
      card.onclick = () => {
        if (card.classList.contains('mode-card-locked')) return;
        const modeId = card.dataset.mode;
        if (onModeChosen) onModeChosen(modeId);
      };
    });
  }

  function byId(id) { return document.getElementById(id); }

  // ── Unlocks: mode select reflects PROGRESS state ───────────────────────
  function refreshModeSelect() {
    const unlocked = progress.get().highestLevelCleared >= 0;
    const customCard = byId('mode-card-custom');
    const endlessCard = byId('mode-card-endless');
    customCard.classList.toggle('mode-card-locked', !unlocked);
    endlessCard.classList.toggle('mode-card-locked', !unlocked);
  }

  // ── Character select ────────────────────────────────────────────────
  function populateCharacterSelect(onChosen) {
    onCharacterChosen = onChosen;
    const grid = byId('char-grid');
    grid.innerHTML = '';
    Object.values(CHARACTERS).forEach(ch => {
      const card = document.createElement('div');
      card.className = 'char-card';
      const img = document.createElement('img');
      ASSETS.applyTo(img, ch.profile);
      const name = document.createElement('div');
      name.className = 'char-card-name';
      name.textContent = ch.name;
      const tagline = document.createElement('div');
      tagline.className = 'char-card-tagline';
      tagline.textContent = ch.tagline;
      card.append(img, name, tagline);
      card.onclick = () => { if (onCharacterChosen) onCharacterChosen(ch.id); };
      grid.appendChild(card);
    });
    showScreen('screen-char-select');
  }

  // ── Custom Mode setup form ──────────────────────────────────────────
  function populateCustomSetup(onStart) {
    onCustomStart = onStart;
    const form = byId('custom-form');
    form.innerHTML = '';

    const fields = [
      { key: 'npcDensity', label: 'NPC Density', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.5 },
      { key: 'environmentNoise', label: 'Environment Noise', type: 'range', min: 0.02, max: 1, step: 0.05, default: 0.4 },
      { key: 'gasPressureLevel', label: 'Gas Pressure Level', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.5 },
      { key: 'smellLevel', label: 'Smell Level', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.5 },
      { key: 'loudLevel', label: 'Loudness Level', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.5 },
      { key: 'targetGas', label: 'Target: 100s of mL of Gas Released', type: 'range', min: 30, max: 300, step: 10, default: 100 },
    ];

    const values = {};
    fields.forEach(f => {
      values[f.key] = f.default;
      const wrap = document.createElement('div');
      wrap.className = 'custom-field';
      const labelRow = document.createElement('div');
      labelRow.className = 'custom-field-label';
      labelRow.innerHTML = `<span>${f.label}</span><span class="value" id="custom-val-${f.key}">${f.default}</span>`;
      const input = document.createElement('input');
      input.type = 'range'; input.className = 'custom-range';
      input.min = f.min; input.max = f.max; input.step = f.step; input.value = f.default;
      input.oninput = () => {
        values[f.key] = parseFloat(input.value);
        byId(`custom-val-${f.key}`).textContent = input.value;
      };
      wrap.append(labelRow, input);
      form.appendChild(wrap);
    });

    // Dropdowns for categorical choices
    const selectDefs = [
      { key: 'locationId', label: 'Location', options: LOCATIONS.map(l => ({ id: l.id, name: l.name })) },
      { key: 'timeId', label: 'Time of Day', options: TIMES_OF_DAY.map(t => ({ id: t.id, name: t.name })) },
      { key: 'companionId', label: 'Companion', options: COMPANIONS.map(c => ({ id: c.id, name: c.name })) },
      { key: 'modifierId', label: 'Special Modifier', options: MODIFIERS.map(m => ({ id: m.id, name: m.name })) },
    ];
    selectDefs.forEach(def => {
      values[def.key] = def.options[0].id;
      const wrap = document.createElement('div');
      wrap.className = 'custom-field';
      const labelRow = document.createElement('div');
      labelRow.className = 'custom-field-label';
      labelRow.innerHTML = `<span>${def.label}</span>`;
      const select = document.createElement('select');
      select.className = 'custom-select';
      def.options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.id; o.textContent = opt.name;
        select.appendChild(o);
      });
      select.onchange = () => { values[def.key] = select.value; };
      wrap.append(labelRow, select);
      form.appendChild(wrap);
    });

    byId('btn-custom-start').onclick = () => { if (onCustomStart) onCustomStart(values); };
    showScreen('screen-custom-setup');
  }

  // ── Story progress map ──────────────────────────────────────────────
  function showStoryMap(onContinue) {
    onStoryContinue = onContinue;
    const p = progress.get();
    const nextLevel = Math.min(31, p.highestLevelCleared + 1);
    const pct = clamp((p.highestLevelCleared / 30) * 100, 0, 100);
    byId('story-progress-fill').style.width = pct + '%';
    byId('story-progress-label').textContent = p.highestLevelCleared >= 30
      ? 'Campaign Complete — Endless Unlocked!'
      : `Level ${nextLevel} of 30`;

    const stats = byId('story-stats');
    stats.innerHTML = '';
    const statDefs = [
      { value: p.highestLevelCleared, label: 'Levels Cleared' },
      { value: p.bestScore, label: 'Best Score' },
      { value: p.totalGasReleased, label: 'Total 100s of mL of Gas Released' },
      { value: p.timesCaught, label: 'Times Caught' },
    ];
    statDefs.forEach(s => {
      const card = document.createElement('div');
      card.className = 'story-stat-card';
      card.innerHTML = `<div class="story-stat-value">${s.value}</div><div class="story-stat-label">${s.label}</div>`;
      stats.appendChild(card);
    });

    byId('btn-story-continue').onclick = () => { if (onStoryContinue) onStoryContinue(); };
    showScreen('screen-story-map');
  }

  // ── Level intro (visual novel) ──────────────────────────────────────
  // `level` is a generated level object from generator.js.
  // `character` is the chosen CHARACTERS entry.
  // `onDone` is called once the player taps through all lines.
  function showLevelIntro(level, character, onDone, isRetry = false) {
    onLevelIntroDone = onDone;

    // Backdrop
    const backdrop = byId('vn-backdrop');
    ASSETS.applyBackground(backdrop, level.location.bg);
    byId('vn-tint').style.background = level.time.tint;

    // Info chips summarizing the level's variables
    const chips = byId('vn-info-chips');
    chips.innerHTML = '';
    const chipDefs = [
      { text: level.location.name },
      { text: level.time.name },
      { text: `NPC Density: ${Math.round(level.npcDensity * 100)}%` },
      { text: `Noise: ${Math.round(level.environmentNoise * 100)}%` },
      { text: `Smell: ${Math.round(level.smellLevel * 100)}%`, cls: level.smellLevel > 0.65 ? 'chip-danger' : level.smellLevel > 0.4 ? 'chip-caution' : 'chip-green' },
      { text: `Loud: ${Math.round(level.loudLevel * 100)}%`, cls: level.loudLevel > 0.65 ? 'chip-danger' : level.loudLevel > 0.4 ? 'chip-caution' : 'chip-green' },
    ];
    if (level.companion.id !== 'none') chipDefs.push({ text: `With: ${level.companion.name}` });
    level.modifiers.filter(m => m.id !== 'none').forEach(m => chipDefs.push({ text: m.name, cls: 'chip-caution' }));
    chipDefs.forEach(c => {
      const chip = document.createElement('div');
      chip.className = 'vn-chip' + (c.cls ? ' ' + c.cls : '');
      chip.textContent = c.text;
      chips.appendChild(chip);
    });

    // Portraits
    const playerPortrait = byId('vn-portrait-player');
    ASSETS.applyTo(playerPortrait, character.vn || character.profile);
    const companionPortrait = byId('vn-portrait-companion');
    if (level.companion.portrait) {
      companionPortrait.hidden = false;
      ASSETS.applyTo(companionPortrait, level.companion.portrait);
    } else {
      companionPortrait.hidden = true;
    }

    // Build the dialogue line sequence from DIALOGUE templates
    const templateData = {
      character: character.name,
      location: level.location.name,
      reason: level.reason,
      time: level.time.name.toLowerCase(),
      companionName: level.companion.name,
      targetGas: level.targetGas,
      modifierName: level.modifiers[0] ? level.modifiers[0].name : '',
      modifierDescription: level.modifiers[0] ? level.modifiers[0].description : '',
    };

    const lines = [];
    lines.push({ speaker: character.name, text: randLine(isRetry ? DIALOGUE.vn_intro_opening_retry : DIALOGUE.vn_intro_opening, templateData) });
    if (level.companion.id === 'none') {
      lines.push({ speaker: character.name, text: randLine(DIALOGUE.vn_intro_companion_none, templateData) });
    } else {
      lines.push({ speaker: character.name, text: randLine(DIALOGUE.vn_intro_companion_present, templateData) });
      const companionLines = DIALOGUE.companions[level.companion.rule];
      if (companionLines) lines.push({ speaker: level.companion.name, text: randLine(companionLines, templateData) });
    }
    if (level.gasPressureLevel > 0.7) lines.push({ speaker: character.name, text: randLine(DIALOGUE.vn_intro_pressure_high, templateData) });
    else if (level.gasPressureLevel > 0.4) lines.push({ speaker: character.name, text: randLine(DIALOGUE.vn_intro_pressure_mid, templateData) });
    else lines.push({ speaker: character.name, text: randLine(DIALOGUE.vn_intro_pressure_low, templateData) });
    if (level.smellLevel > 0.6) lines.push({ speaker: character.name, text: randLine(DIALOGUE.vn_intro_smell_warning, templateData) });
    if (level.loudLevel > 0.6) lines.push({ speaker: character.name, text: randLine(DIALOGUE.vn_intro_loud_warning, templateData) });
    level.modifiers.filter(m => m.id !== 'none').forEach(m => {
      lines.push({ speaker: character.name, text: fillTemplate(randFrom(DIALOGUE.vn_intro_modifier), { modifierName: m.name, modifierDescription: m.description }) });
    });
    lines.push({ speaker: character.name, text: randLine(DIALOGUE.vn_intro_closing, templateData) });

    let idx = 0;
    function renderLine() {
      const l = lines[idx];
      byId('vn-speaker').textContent = l.speaker;
      byId('vn-line').textContent = l.text;
      byId('vn-next-btn').textContent = (idx === lines.length - 1) ? 'Start ▶' : 'Next ▶';
    }
    renderLine();
    byId('vn-next-btn').onclick = () => {
      idx++;
      if (idx >= lines.length) {
        if (onLevelIntroDone) onLevelIntroDone();
      } else {
        renderLine();
      }
    };

    showScreen('screen-level-intro');
  }

  // ── Level complete screen ───────────────────────────────────────────
  function showLevelComplete(result, character, onNext, onMenu) {
    byId('complete-title').textContent = result.success ? 'Level Complete!' : 'Busted!';
    byId('complete-sub').textContent = result.success
      ? randLine(DIALOGUE.level_complete, { character: result.characterName })
      : randLine(DIALOGUE.level_failed_suspicion, { character: result.characterName });

    // Fix 4: show a success facecam (success1 or success2) on level complete.
    const facecamWrap = byId('complete-facecam-wrap');
    const facecamImg = byId('complete-facecam');
    if (result.success && character && character.faces) {
      const successKey = Math.random() < 0.5 ? 'success1' : 'success2';
      const successSrc = character.faces[successKey];
      if (successSrc) {
        ASSETS.applyTo(facecamImg, successSrc);
        if (facecamWrap) facecamWrap.style.display = '';
      } else {
        if (facecamWrap) facecamWrap.style.display = 'none';
      }
    } else {
      if (facecamWrap) facecamWrap.style.display = 'none';
    }

    const stats = byId('complete-stats');
    stats.innerHTML = '';
    const statDefs = [
      { value: result.score, label: 'Score' },
      { value: Math.round(result.gasReleased), label: '100s of mL of Gas Released' },
      { value: result.difficultyScore + '/10', label: 'Difficulty' },
    ];
    statDefs.forEach(s => {
      const card = document.createElement('div');
      card.className = 'complete-stat';
      card.innerHTML = `<div class="complete-stat-value">${s.value}</div><div class="complete-stat-label">${s.label}</div>`;
      stats.appendChild(card);
    });

    byId('btn-complete-next').textContent = result.success ? 'Next Level' : 'Try Again';
    byId('btn-complete-next').onclick = onNext;
    byId('btn-complete-menu').onclick = onMenu;

    // Inject fart log summary if available
    const fartLogWrap = byId('complete-fart-log');
    if (fartLogWrap && result.fartSummary) {
      fartLogWrap.innerHTML = FART_TRACKER.buildSummaryHTML(result.fartSummary);
      fartLogWrap.style.display = '';
    } else if (fartLogWrap) {
      fartLogWrap.style.display = 'none';
    }

    showScreen('screen-level-complete');
  }

  // ── Caught / failure screen ─────────────────────────────────────────
  // Shown for ANY suspicion-meter mode (story, stealth, custom, endless)
  // the instant suspicion hits 100 and the player is caught. Distinct
  // from showLevelComplete: this is specifically the "you got caught"
  // failure state, with the character's caught facecam and three
  // separate exits (Retry same level/run, Character Select, Main Menu)
  // rather than auto-restarting anything.
  // `character` is the active CHARACTERS entry (for its caught facecam
  // assets — character.faces.caught1/caught2, same images PLAYER.setFace
  // already uses in-scene). `onRetry`/`onCharacterSelect`/`onMainMenu`
  // are callbacks wired by main.js.
  function showCaughtScreen(result, character, onRetry, onCharacterSelect, onMainMenu) {
    byId('caught-title').textContent = 'Failed! Try Again';
    byId('caught-sub').textContent = randLine(DIALOGUE.level_failed_suspicion, { character: result.characterName });

    // Use the same caught facecam pool the in-scene face already uses
    // (character.faces.caught1 / caught2) — pick one at random so a
    // retry can show either expression.
    const facecamImg = byId('caught-facecam');
    const caughtKey = Math.random() < 0.5 ? 'caught1' : 'caught2';
    ASSETS.applyTo(facecamImg, character.faces[caughtKey]);

    const stats = byId('caught-stats');
    stats.innerHTML = '';
    const statDefs = [
      { value: result.score, label: 'Score' },
      { value: Math.round(result.gasReleased), label: '100s of mL of Gas Released' },
    ];
    statDefs.forEach(s => {
      const card = document.createElement('div');
      card.className = 'complete-stat';
      card.innerHTML = `<div class="complete-stat-value">${s.value}</div><div class="complete-stat-label">${s.label}</div>`;
      stats.appendChild(card);
    });

    byId('btn-caught-retry').onclick = onRetry;
    byId('btn-caught-charselect').onclick = onCharacterSelect;
    byId('btn-caught-mainmenu').onclick = onMainMenu;

    // Inject fart log summary if available
    const caughtFartLogWrap = byId('caught-fart-log');
    if (caughtFartLogWrap && result.fartSummary) {
      caughtFartLogWrap.innerHTML = FART_TRACKER.buildSummaryHTML(result.fartSummary);
      caughtFartLogWrap.style.display = '';
    } else if (caughtFartLogWrap) {
      caughtFartLogWrap.style.display = 'none';
    }

    showScreen('screen-caught');
  }

  return {
    init, showScreen, refreshModeSelect, populateCharacterSelect,
    populateCustomSetup, showStoryMap, showLevelIntro, showLevelComplete,
    showCaughtScreen,
    setOnModeChosen(fn) { onModeChosen = fn; },
  };
})();
