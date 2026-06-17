/* ============================================================================
   GAME.JS — CORE GAMEPLAY LOOP
   ============================================================================
   Owns everything inside #screen-game: wiring up DOM refs once, starting a
   level (given a level definition from generator.js + a chosen character +
   a game mode), running the per-frame loop (NPC spawning/movement, cloud
   updates, player updates, suspicion/score bookkeeping, companion hooks),
   and handling win/lose/pause.

   game.js does NOT know about the title screen, mode select, story map,
   or level-complete screen — it only knows how to run ONE level and report
   back what happened via the `onLevelEnd` callback (set via setCallbacks).
   main.js is responsible for stringing levels together, persistence, and
   screen flow.

   GAME MODES this file understands (level.mode):
     'story'   — suspicion + target gas, generated level, ends on target hit
                 or suspicion maxed; level intro/complete screens used by
                 main.js around this.
     'stealth' — classic free-play: suspicion + gas, no target, survive as
                 long as possible (ends only on getting caught).
     'chaos'   — infinite gas, no suspicion meter at all, just go wild.
     'custom'  — same numeric shape as story (suspicion + target), but the
                 level object comes from the custom setup form instead of
                 the procedural generator.
     'endless' — same as story but levelNumber keeps climbing past 30 and
                 difficultyScore is used for a running high-score feel.
   ========================================================================= */

const GAME = (() => {
  let els = {};
  let level = null;
  let mode = 'stealth';
  let character = null;

  let suspicion = 0;
  let score = 0;
  let gasReleased = 0;
  let running = false;
  let paused = false;
  let rafId = null;
  let lastT = 0;
  let spawnTimer = 0;
  let statusTimer = 0;

  let onLevelEnd = null; // callback(result) — set by main.js

  // Context object shared with companion.js rule handlers.
  const ctx = {
    state: {},
    companionName: '',
    setStatus,
  };

  // ── DOM wiring (called once on boot) ──────────────────────────────────
  function init() {
    els = {
      scene: byId('scene'),
      sceneBg: byId('scene-bg'),
      sceneTint: byId('scene-tint'),
      sky: byId('sky'), ground: byId('ground'), path: byId('path'),
      hudLevelTag: byId('hud-level-tag'),
      companionWrap: byId('companion-wrap'),
      companionImg: byId('companion-img'),
      companionName: byId('companion-name'),
      playerWrap: byId('player-wrap'),
      playerImg: byId('player-img'),
      powerRing: byId('power-ring'),
      powerArc: byId('power-arc'),
      powerLabel: byId('power-label'),
      faceImg: byId('face-img'),
      faceLabel: byId('face-label'),
      overlay: byId('overlay'),
      overlayTitle: byId('overlay-title'),
      overlaySub: byId('overlay-sub'),
      overlayScore: byId('overlay-score'),
      overlayBtn: byId('overlay-btn'),
      overlayBtnMenu: byId('overlay-btn-menu'),
      suspBar: byId('susp-bar'),
      gasCard: byId('gas-card'),
      gasBar: byId('gas-bar'),
      scoreVal: byId('score-val'),
      targetCard: byId('target-card'),
      targetBar: byId('target-bar'),
      targetText: byId('target-text'),
      extraHudCard: byId('extra-hud-card'),
      extraHudLabel: byId('extra-hud-label'),
      extraHudBar: byId('extra-hud-bar'),
      btnLeft: byId('btn-left'),
      btnRight: byId('btn-right'),
      btnPause: byId('btn-pause'),
      statusMsg: byId('status-msg'),
    };

    NPC_SYSTEM.init(els.scene);
    CLOUD_SYSTEM.init(els.scene, els.playerWrap);
    CLOUD_SYSTEM.setDetectionCallback(handleNpcDetected);

    relocatePowerMeterToHud();

    PLAYER.init({
      playerWrap: els.playerWrap, playerImg: els.playerImg,
      powerRing: els.powerRing, powerArc: els.powerArc, powerLabel: els.powerLabel,
      faceImg: els.faceImg, faceLabel: els.faceLabel,
    });
    PLAYER.setCallbacks({ onRelease: handlePlayerRelease, onInvoluntary: handleInvoluntary });

    wireControls();

    els.btnPause.onclick = () => { if (running) setPaused(!paused); };
    els.overlayBtnMenu.onclick = () => { if (onLevelEnd) finish(lastResultForMenu()); };
  }

  // ── Move the circular charge/power meter off the character and into a
  // fixed HUD corner ──────────────────────────────────────────────────
  // Previously #power-ring was positioned by CSS relative to the player
  // sprite (it visually surrounded the character while leaning). Since
  // there's no separate stylesheet change being made here, this re-homes
  // the element directly: re-parents it into the scene root and applies
  // explicit corner-anchored inline positioning so it always renders as
  // a standalone HUD element in the bottom-right of the game screen,
  // independent of wherever the player sprite is or moves to. All of
  // player.js's existing opacity/stroke/text updates to this element
  // keep working unchanged — only its position in the DOM/layout moves.
  // NOTE: ids/classes are unchanged, so if a real stylesheet rule for
  // #power-ring already exists in index.html's CSS, these inline styles
  // intentionally override it (inline style has higher specificity) —
  // the corner position below is authoritative.
  function relocatePowerMeterToHud() {
    if (!els.powerRing || !els.scene) return;
    // Defensive: absolute-positioned children anchor to the nearest
    // positioned ancestor. If #scene's stylesheet doesn't already set
    // position:relative/absolute/fixed, force it here so the corner
    // anchoring below is reliable regardless of the existing CSS.
    const sceneComputedPosition = window.getComputedStyle(els.scene).position;
    if (sceneComputedPosition === 'static') {
      els.scene.style.position = 'relative';
    }
    els.scene.appendChild(els.powerRing); // re-parent: no longer nested under player-wrap
    Object.assign(els.powerRing.style, {
      position: 'absolute',
      right: '14px',
      bottom: '14px',
      left: 'auto',
      top: 'auto',
      transform: 'none',
      zIndex: '40', // above scene art/NPCs, alongside other HUD chrome
      pointerEvents: 'none',
    });
  }

  function byId(id) { return document.getElementById(id); }

  function setCallbacks(cbs) {
    onLevelEnd = cbs.onLevelEnd || null;
  }

  // ── Input wiring: mouse + touch, both buttons ──────────────────────────
  function wireControls() {
    bindHoldButton(els.btnLeft, -1);
    bindHoldButton(els.btnRight, 1);
  }

  function bindHoldButton(btn, dir) {
    const start = (e) => { e.preventDefault(); if (!running || paused) return; btn.classList.add('held'); PLAYER.startHold(dir); };
    const end = (e) => { if (e) e.preventDefault(); btn.classList.remove('held'); PLAYER.stopHold(); };
    btn.addEventListener('mousedown', start);
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
    btn.addEventListener('touchend', end);
    btn.addEventListener('touchcancel', end);
  }

  // ── Starting a level ───────────────────────────────────────────────────
  // `levelDef` is a generator.js level object (or an equivalent shape built
  // by main.js for custom mode). `gameMode` picks which ruleset above
  // applies. `charDef` is a CHARACTERS entry.
  function start(levelDef, gameMode, charDef) {
    level = levelDef;
    mode = gameMode;
    character = charDef;

    suspicion = 0;
    score = 0;
    gasReleased = 0;
    paused = false;
    spawnTimer = 0;
    statusTimer = 0;
    ctx.state = {};

    NPC_SYSTEM.clear();
    CLOUD_SYSTEM.clear();
    CLOUD_SYSTEM.setModifiers(level.modifiers || []);

    PLAYER.setCharacter(character);
    PLAYER.setGasPressureLevel(mode === 'chaos' ? 1 : level.gasPressureLevel);
    PLAYER.reset(mode === 'chaos' ? 100 : 40);

    setLocationBackground(level.location);
    els.sceneTint.style.background = level.time ? level.time.tint : 'rgba(0,0,0,0)';
    els.hudLevelTag.textContent = levelTagText();

    setupCompanion();
    setupHudVisibility();
    updateSuspicionBar(0);
    updateGasBar();
    updateScore(0);
    updateTargetBar();

    els.overlay.classList.remove('show');
    els.statusMsg.textContent = '';

    running = true;
    lastT = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function levelTagText() {
    if (mode === 'chaos') return 'Chaos Mode';
    if (mode === 'stealth') return 'Stealth Mode';
    if (mode === 'custom') return 'Custom Level';
    if (level.isEndless) return `Endless · Lvl ${level.levelNumber}`;
    return `Level ${level.levelNumber} / 30`;
  }

  function setLocationBackground(location) {
    if (!location) { els.scene.classList.add('no-bg-art'); return; }
    els.scene.classList.remove('no-bg-art');
    ASSETS.applyBackground(els.sceneBg, location.bg);
  }

  function setupCompanion() {
    const companion = level.companion;
    if (!companion || companion.id === 'none') {
      els.companionWrap.style.display = 'none';
      COMPANION_SYSTEM.init({ id: 'none', name: '', rule: 'none' }, ctx);
      return;
    }
    els.companionWrap.style.display = 'block';
    ASSETS.applyTo(els.companionImg, companion.portrait);
    els.companionName.textContent = companion.name;
    COMPANION_SYSTEM.init(companion, ctx);
  }

  // Thematic label for the story/target progress bar — was generic
  // "Target"/numeric-only before; now consistently shown everywhere this
  // bar's purpose is described (HUD card label, target text, overlay
  // summary, custom-setup form, level-complete stats). Change this one
  // string to retheme the whole progress bar's wording everywhere.
  const PROGRESS_LABEL = '100s of mL of Gas Released';

  function setupHudVisibility() {
    // Suspicion bar: hidden entirely in Chaos Mode (no suspicion concept).
    els.suspBar.parentElement.parentElement.style.display = (mode === 'chaos') ? 'none' : '';

    // Gas bar: relabeled / hidden meaning in Chaos (infinite gas — show full, static).
    if (mode === 'chaos') {
      els.gasCard.querySelector('.hud-label').textContent = 'Gas Pressure';
    } else {
      els.gasCard.querySelector('.hud-label').textContent = 'Gas Pressure';
    }

    // Target progress: only shown when this level has a real target.
    const hasTarget = (mode === 'story' || mode === 'custom' || mode === 'endless');
    els.targetCard.style.display = hasTarget ? 'block' : 'none';
    if (hasTarget) {
      const targetLabelEl = els.targetCard.querySelector('.hud-label');
      if (targetLabelEl) targetLabelEl.textContent = PROGRESS_LABEL;
    }

    // Extra HUD (e.g. Romance Meter) driven by companion rule, if any.
    refreshExtraHud();
  }

  function refreshExtraHud() {
    const extra = COMPANION_SYSTEM.getExtraHud();
    if (extra) {
      els.extraHudCard.style.display = 'block';
      els.extraHudLabel.textContent = extra.label;
      els.extraHudBar.style.width = clamp((extra.value / extra.max) * 100, 0, 100) + '%';
    } else {
      els.extraHudCard.style.display = 'none';
    }
  }

  // ── Main loop ───────────────────────────────────────────────────────────
  function loop(now) {
    if (!running) return;
    const dt = Math.min(64, now - lastT);
    lastT = now;

    if (!paused) {
      update(dt);
    }

    rafId = requestAnimationFrame(loop);
  }

  function update(dt) {
    // Spawn NPCs at a rate driven by density (more density = more frequent).
    spawnTimer += dt;
    const density = level.npcDensity !== undefined ? level.npcDensity : 0.5;
    const spawnInterval = lerp(1900, 550, clamp(density, 0, 1));
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      NPC_SYSTEM.spawn(density, mode === 'chaos' ? 1.3 : 1);
    }

    NPC_SYSTEM.update(dt);
    CLOUD_SYSTEM.update(dt);
    PLAYER.update(dt);
    COMPANION_SYSTEM.tick(dt);
    refreshExtraHud();

    PLAYER.updateIdleFace(mode === 'chaos' ? 0 : suspicion);
    updateGasBar();

    if (statusTimer > 0) {
      statusTimer -= dt;
      if (statusTimer <= 0) els.statusMsg.textContent = '';
    }

    if (mode !== 'chaos') {
      // Passive suspicion decay so a clean stretch slowly cools down.
      // Decay never fires once suspicion is already maxed — otherwise a
      // single frame of decay right after a detection could yank the bar
      // back under 100 in the same tick and the catch would never trigger.
      if (suspicion < 100) {
        const decayMult = CLOUD_SYSTEM.modEffect('suspicionDecayMult');
        suspicion = clamp(suspicion - dt * 0.0035 * decayMult, 0, 100);
      }
      updateSuspicionBar(suspicion);

      if (suspicion >= 100) {
        triggerCaught();
        return;
      }
    }

    if ((mode === 'story' || mode === 'custom' || mode === 'endless') && level.targetGas) {
      updateTargetBar();
      if (gasReleased >= level.targetGas) {
        triggerWin();
        return;
      }
    }
  }

  // ── Player release → cloud + loudness pulse + scoring ─────────────────
  // `power` is 0..1 hold power. `isPuff` marks a mid-hold puff vs a full
  // release on button-up (both still emit smell/loudness, full release
  // additionally adds to gasReleased/score).
  // Cloud direction vs. lean direction (REVERSED — see mechanics note):
  // cloud.js's spawnSmellCloud() internally flips whatever `dir` it's
  // given (spawn offset uses -dir*50, drift uses -dir), so passing the
  // raw lean direction here actually makes the cloud travel in the SAME
  // direction the player leaned. To get "lean left -> fart travels
  // right" / "lean right -> fart travels left" (cross directions), we
  // must pass leanDir straight through (NOT inverted) so cloud.js's
  // internal flip produces the opposite-of-lean travel. Lean
  // animations/controls are untouched — only this direction value.
  function handlePlayerRelease(power, isPuff) {
    const smellLevel = mode === 'chaos' ? 0.7 : level.smellLevel;
    const loudLevel = mode === 'chaos' ? 0.7 : level.loudLevel;
    const envNoise = level.environmentNoise !== undefined ? level.environmentNoise : 0.3;

    const leanDir = PLAYER.getHoldDir();
    // leanDir itself (not -leanDir) so the cloud ends up traveling
    // opposite to the lean direction once cloud.js's internal flip
    // is applied. Random fallback (idle/involuntary release) unchanged.
    const cloudDir = leanDir !== 0 ? leanDir : (Math.random() < 0.5 ? -1 : 1);
    CLOUD_SYSTEM.spawnSmellCloud(cloudDir, power, smellLevel);
    const { hits, effectiveLoud } = CLOUD_SYSTEM.emitLoudnessPulse(power, loudLevel, envNoise);

    COMPANION_SYSTEM.onPlayerRelease({ power, smellLevel, loudLevel });

    hits.forEach(h => reactNpc(h.npc, 'loud', power, h.closeness));
    if (effectiveLoud > 0.55 && hits.length === 0) {
      // Loud but nobody in range — still flavor text, no penalty.
    }

    // Progress ("gas released") contribution per release — now tied
    // DIRECTLY to the fart meter (`power`, 0..1 hold charge) using true
    // EXPONENTIAL scaling rather than a polynomial curve, so the value
    // grows much faster near the top of the meter than a power^n curve
    // would. normalizedExp(power) = (e^(EXP_K*power) - 1) / (e^EXP_K - 1)
    // is 0 at power=0, 1 at power=1, and curves upward increasingly
    // steeply as EXP_K grows — i.e. a fully-charged fart is worth
    // dramatically more than a half-charged one, which is worth only
    // slightly more than a quick tap. PROGRESS_CAP raised substantially
    // from before so a big charged fart visibly devours a huge chunk of
    // the bar in one release; PROGRESS_FLOOR keeps a bare tap from being
    // worth literally nothing. Mid-hold "puffs" (and by extension rapid
    // spam-clicking, which mostly produces taps/puffs rather than a full
    // charge) stay scaled down hard so they can't substitute for an
    // actual sustained charge.
    const PROGRESS_FLOOR = 0.3;     // minimum credit for a bare tap
    const PROGRESS_CAP = 14;        // maximum credit a single fully-charged release can award
    const EXP_K = 5.5;              // higher = steeper exponential curve = big farts matter even more
    const p = clamp(power, 0, 1);
    const normalizedExp = (Math.exp(EXP_K * p) - 1) / (Math.exp(EXP_K) - 1);
    const fullReleaseAmount = PROGRESS_FLOOR + normalizedExp * (PROGRESS_CAP - PROGRESS_FLOOR);
    const amount = isPuff ? fullReleaseAmount * 0.1 : fullReleaseAmount;
    gasReleased += amount;
    if (mode !== 'chaos') {
      score += Math.round(amount * 8);
      updateScore(score);
    } else {
      score += Math.round(amount * 5);
      updateScore(score);
    }

    if (!isPuff) {
      const pool = power > 0.7 ? DIALOGUE.chaos : DIALOGUE.release;
      setStatus(randFrom(mode === 'chaos' ? DIALOGUE.chaos : pool), 1800);
    }
  }

  function handleInvoluntary() {
    setStatus(randFrom(DIALOGUE.involuntary), 1800);
    const envNoise = level.environmentNoise !== undefined ? level.environmentNoise : 0.3;
    CLOUD_SYSTEM.spawnSmellCloud(1, 0.8, mode === 'chaos' ? 0.7 : level.smellLevel);
    const { hits } = CLOUD_SYSTEM.emitLoudnessPulse(0.9, mode === 'chaos' ? 0.7 : level.loudLevel, envNoise);
    hits.forEach(h => reactNpc(h.npc, 'loud', 0.9, h.closeness));
    gasReleased += 3;
  }

  // ── NPC detection / reaction ────────────────────────────────────────────
  function handleNpcDetected(npc, info) {
    reactNpc(npc, info.source, info.power, info.closeness);
  }

  // `power` = fart size/intensity (0..1, from hold charge or involuntary
  // release). `closeness` = how close the detecting NPC was within the
  // detection radius (1 = right on top of it, 0 = at the very edge) —
  // now supplied for BOTH loud and smell detections (see cloud.js).
  // Defaults to 1 (no falloff) for chaos-mode flavor hits that don't
  // pass it.
  function reactNpc(npc, source, power, closeness = 1) {
    if (npc.reacted && source === 'smell') return; // smell already tagged this npc once
    npc.reacted = true;

    const intensity = clamp(power, 0, 1);
    const pool = intensity > 0.75 ? DIALOGUE.npc_chaos
      : intensity > 0.5 ? DIALOGUE.npc_strong
      : intensity > 0.25 ? DIALOGUE.npc_medium
      : DIALOGUE.npc_mild;

    showNpcSpeech(npc, randFrom(pool));

    const reactEl = npc.el.querySelector('.npc-react');
    if (reactEl) reactEl.textContent = intensity > 0.6 ? '😡' : intensity > 0.3 ? '😟' : '🤔';

    if (mode === 'chaos') {
      score += Math.round(intensity * 12);
      updateScore(score);
      setStatus(randFrom(DIALOGUE.hit), 1300);
      return;
    }

    // SUSPICION SCALING (size dampened, distance falloff strengthened):
    // - sizeFactor: previously suspicion scaled linearly with `intensity`
    //   (bigger fart = proportionally more suspicion). Now a "largeness
    //   penalty" shrinks the multiplier as intensity grows, so a fully
    //   charged release (intensity=1) generates noticeably LESS total
    //   suspicion than the old linear formula gave it, while quick/small
    //   farts (low intensity) are barely changed. SIZE_PENALTY controls
    //   how much big farts get discounted (0 = no discount/old behavior,
    //   higher = bigger farts generate progressively less suspicion).
    // - distanceFactor raises closeness to a power > 1, which pushes the
    //   falloff curve down hard for anything not very close — i.e.
    //   distance now reduces suspicion much more aggressively than the
    //   old direct multiply did.
    const SIZE_PENALTY = 0.55;
    const sizeFactor = intensity * (1 - SIZE_PENALTY * intensity);
    const distanceFactor = Math.pow(clamp(closeness, 0, 1), 2.4);

    let baseGain = sizeFactor * distanceFactor * (10 + npc.depthMeta.detectionMult * 8)
      * (CLOUD_SYSTEM.modEffect('suspicionFromSoundMult') || 1);
    if (source === 'loud') baseGain *= 1.15;

    const finalGain = COMPANION_SYSTEM.modifySuspicionGain(baseGain, { source, power: intensity });
    suspicion = clamp(suspicion + finalGain, 0, 100);
    updateSuspicionBar(suspicion);

    if (finalGain > 0 && intensity > 0.4) {
      setStatus(randFrom(DIALOGUE.suspicious), 1600);
    }

    if (suspicion >= 100 && running) {
      triggerCaught();
    }
  }

  function showNpcSpeech(npc, text) {
    const bubble = npc.el.querySelector('.npc-speech');
    if (!bubble) return;
    bubble.textContent = text;
    bubble.classList.add('visible');
    clearTimeout(npc.speechTimeout);
    npc.speechTimeout = setTimeout(() => bubble.classList.remove('visible'), 1700);
  }

  // ── Status line helper (also used by companion.js via ctx.setStatus) ──
  function setStatus(text, durationMs = 1500) {
    els.statusMsg.textContent = text;
    statusTimer = durationMs;
  }

  // ── HUD updates ─────────────────────────────────────────────────────────
  function updateSuspicionBar(value) {
    els.suspBar.style.width = clamp(value, 0, 100) + '%';
    els.suspBar.style.background = value > 70 ? '#cc3b3b' : value > 40 ? '#e8a020' : '#3a9e3a';
  }

  function updateGasBar() {
    const g = mode === 'chaos' ? 100 : PLAYER.getGas();
    els.gasBar.style.width = clamp(g, 0, 100) + '%';
    els.gasBar.style.background = g > 85 ? '#cc3b3b' : g > 55 ? '#e8a020' : '#5b8def';
  }

  function updateScore(value) {
    els.scoreVal.textContent = String(Math.round(value));
  }

  function updateTargetBar() {
    if (!level || !level.targetGas) return;
    const pct = clamp((gasReleased / level.targetGas) * 100, 0, 100);
    els.targetBar.style.width = pct + '%';
    els.targetText.textContent = `${Math.round(gasReleased)} / ${level.targetGas} (${PROGRESS_LABEL})`;
  }

  // ── End states ──────────────────────────────────────────────────────────
  // Called the instant suspicion maxes out (from update()'s passive check
  // or immediately from reactNpc() on a big detection). Guarded by
  // `running` so it can only ever fire once per level. This now pauses
  // the run and reports a `caught: true` result through onLevelEnd —
  // main.js/ui.js are responsible for showing the dedicated caught/
  // failure screen (character facecam + Retry/Character Select/Main
  // Menu) instead of this file silently restarting anything itself.
  function triggerCaught() {
    if (!running) return;
    running = false;
    PLAYER.stopHold();
    PLAYER.setFace(Math.random() < 0.5 ? 'caught1' : 'caught2', true);
    setStatus(randFrom(DIALOGUE.caught), 1200);
    setTimeout(() => finish(buildResult(false, { caught: true })), 700);
  }

  function triggerWin() {
    if (!running) return;
    running = false;
    PLAYER.stopHold();
    showOverlay('Mission Complete!', randLine(DIALOGUE.level_complete, { character: character.name }), true);
  }

  function showOverlay(title, sub, success) {
    els.overlayTitle.textContent = title;
    els.overlaySub.textContent = sub;
    els.overlayScore.textContent = `Score: ${Math.round(score)}  ·  ${PROGRESS_LABEL}: ${Math.round(gasReleased)}`;
    els.overlayBtn.textContent = success ? 'Continue' : 'Try Again';
    els.overlayBtn.onclick = () => finish(buildResult(success));
    els.overlay.classList.add('show');
  }

  // `extra` lets specific call sites attach result flags beyond plain
  // success/failure — currently:
  //   caught: true        — suspicion hit 100, player was actually caught
  //   exitedToMenu: true  — player chose "Back to Modes" from the pause
  //                         screen; NOT a catch, must not be treated as one
  function buildResult(success, extra = {}) {
    return {
      success,
      score: Math.round(score),
      gasReleased,
      difficultyScore: level.difficultyScore || 0,
      characterName: character ? character.name : '',
      character,
      levelNumber: level ? level.levelNumber : 0,
      mode,
      caught: false,
      exitedToMenu: false,
      ...extra,
    };
  }

  function lastResultForMenu() {
    // "Back to Modes" from the pause/overlay screen. This is a deliberate
    // menu exit, NOT a catch — exitedToMenu:true lets main.js tell the
    // difference from triggerCaught()'s result and route straight to
    // screen-mode-select instead of misreading this as a failed/caught
    // run that needs the caught screen or a same-level restart.
    return buildResult(false, { exitedToMenu: true });
  }

  function finish(result) {
    running = false;
    els.overlay.classList.remove('show');
    if (rafId) cancelAnimationFrame(rafId);
    if (onLevelEnd) onLevelEnd(result);
  }

  // ── Pause ───────────────────────────────────────────────────────────────
  function setPaused(p) {
    paused = p;
    if (paused) {
      PLAYER.stopHold();
      showOverlay('Paused', 'Take a breather. The pressure will still be here.', null);
      els.overlayBtn.textContent = 'Resume';
      els.overlayBtn.onclick = () => { els.overlay.classList.remove('show'); setPaused(false); };
    } else {
      els.overlay.classList.remove('show');
      lastT = performance.now();
    }
  }

  function stop() {
    running = false;
    PLAYER.stopHold();
    if (rafId) cancelAnimationFrame(rafId);
    NPC_SYSTEM.clear();
    CLOUD_SYSTEM.clear();
    els.overlay.classList.remove('show');
  }

  return { init, setCallbacks, start, stop };
})();
