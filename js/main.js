/* ============================================================================
   MAIN.JS — APP BOOTSTRAP & SCREEN FLOW
   ============================================================================
   This file is the "glue": it owns PROGRESS (persisted save data), wires
   every UI callback to either show another screen or hand off to GAME,
   and is the only place that decides what happens AFTER a level ends
   (go to level-complete, then back to the story map / mode select / a
   freshly generated next level, depending on which mode was played).

   Boot order on DOMContentLoaded:
     1. Load/repair PROGRESS from localStorage.
     2. UI.init(PROGRESS) + GAME.init() wire up all static DOM.
     3. Show the title screen.
   ========================================================================= */

/* ----------------------------------------------------------------------
   PROGRESS — small persisted save-data wrapper (localStorage-backed).
   Shape: { highestLevelCleared, bestScore, totalGasReleased, timesCaught }
   Falls back gracefully (in-memory only) if localStorage is unavailable
   (e.g. private browsing / sandboxed iframe).
------------------------------------------------------------------------- */
const PROGRESS = (() => {
  const STORAGE_KEY = 'holdItIn_progress_v1';
  const DEFAULTS = { highestLevelCleared: 0, bestScore: 0, totalGasReleased: 0, timesCaught: 0 };
  let data = { ...DEFAULTS };
  let storageOk = true;

  function load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) data = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch (e) {
      storageOk = false;
    }
  }

  function save() {
    if (!storageOk) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      storageOk = false;
    }
  }

  function get() { return data; }

  function recordLevelResult(result) {
    if (result.mode === 'story' && result.success) {
      data.highestLevelCleared = Math.max(data.highestLevelCleared, result.levelNumber);
    }
    data.bestScore = Math.max(data.bestScore, result.score);
    data.totalGasReleased = Math.round(data.totalGasReleased + result.gasReleased);
    if (!result.success) data.timesCaught += 1;
    save();
  }

  function reset() {
    data = { ...DEFAULTS };
    save();
  }

  load();
  return { get, recordLevelResult, reset };
})();


/* ----------------------------------------------------------------------
   APP — screen-flow state machine sitting between UI and GAME.
------------------------------------------------------------------------- */
const APP = (() => {
  let selectedMode = null;
  let selectedCharacter = null;
  let storyLevelNumber = 1;
  let customOptions = null;

  function init() {
    UI.init(PROGRESS);
    GAME.init();
    GAME.setCallbacks({ onLevelEnd: handleLevelEnd });
    UI.setOnModeChosen(handleModeChosen);
    UI.refreshModeSelect();
    UI.showScreen('screen-title');
  }

  // ── Mode select → character select (every mode needs a character) ────
  function handleModeChosen(modeId) {
    selectedMode = modeId;

    if (modeId === 'story') {
      storyLevelNumber = Math.min(31, PROGRESS.get().highestLevelCleared + 1);
    }

    UI.populateCharacterSelect((characterId) => {
      selectedCharacter = CHARACTERS[characterId];
      // Preload all face/body images for this character so facecam swaps
      // are instant during gameplay — no placeholder flash on first use.
      ASSETS.preloadCharacter(selectedCharacter).then(() => {
        afterCharacterChosen();
      });
    });
  }

  function afterCharacterChosen() {
    if (selectedMode === 'custom') {
      UI.populateCustomSetup((values) => {
        customOptions = values;
        beginCustomLevel();
      });
      return;
    }

    if (selectedMode === 'story' || selectedMode === 'endless') {
      UI.showStoryMap(() => {
        const levelNumber = selectedMode === 'endless'
          ? Math.max(31, PROGRESS.get().highestLevelCleared + 1)
          : storyLevelNumber;
        beginGeneratedLevel(levelNumber, selectedMode === 'endless' ? 'endless' : 'story');
      });
      return;
    }

    // Stealth + Chaos: no intro screen needed, jump straight into a level.
    if (selectedMode === 'stealth') {
      beginGeneratedLevel(randInt(1, 30), 'stealth');
    } else if (selectedMode === 'chaos') {
      beginGeneratedLevel(randInt(1, 30), 'chaos');
    }
  }

  // ── Building + intro-ing a procedurally generated level ────────────────
  function beginGeneratedLevel(levelNumber, mode, isRetry = false) {
    const levelDef = GENERATOR.buildLevel(levelNumber);

    if (mode === 'story' || mode === 'endless') {
      UI.showLevelIntro(levelDef, selectedCharacter, () => {
        GAME.start(levelDef, mode, selectedCharacter);
        UI.showScreen('screen-game');
      }, isRetry);
    } else {
      GAME.start(levelDef, mode, selectedCharacter);
      UI.showScreen('screen-game');
    }
  }

  // ── Custom mode: build a level-shaped object straight from the form ───
  function beginCustomLevel() {
    const v = customOptions;
    const location = LOCATIONS.find(l => l.id === v.locationId) || LOCATIONS[0];
    const time = TIMES_OF_DAY.find(t => t.id === v.timeId) || TIMES_OF_DAY[0];
    const companion = COMPANIONS.find(c => c.id === v.companionId) || COMPANIONS[0];
    const modifier = MODIFIERS.find(m => m.id === v.modifierId) || MODIFIERS[0];

    const levelDef = {
      levelNumber: 0,
      isEndless: false,
      location, time, companion,
      modifiers: [modifier],
      reason: randFrom(location.flavorReasons),
      npcDensity: v.npcDensity,
      environmentNoise: v.environmentNoise,
      gasPressureLevel: v.gasPressureLevel,
      smellLevel: v.smellLevel,
      loudLevel: v.loudLevel,
      targetGas: v.targetGas,
      timeLimitMs: 150000,
      difficultyScore: Math.round(clamp(
        (v.npcDensity * 2.2) + (v.gasPressureLevel * 1.8) +
        (v.smellLevel * 1.2) + (v.loudLevel * 1.2) +
        (1 - v.environmentNoise) * 1.2, 0, 10
      )),
    };

    UI.showLevelIntro(levelDef, selectedCharacter, () => {
      GAME.start(levelDef, 'custom', selectedCharacter);
      UI.showScreen('screen-game');
    });
  }

  // ── After a level ends ──────────────────────────────────────────────────
  function handleLevelEnd(result) {
    GAME.stop();

    if (result.caught) {
      // Suspicion maxed out — show the dedicated caught/failure screen
      // (character's caught facecam + failure line) for ANY suspicion
      // mode (story, stealth, custom, endless), instead of jumping
      // straight back into a VN intro or (worse) the success screen.
      PROGRESS.recordLevelResult(result);
      UI.refreshModeSelect();
      UI.showCaughtScreen(
        result,
        selectedCharacter,
        () => retrySameRun(result),
        () => goToCharacterSelect(),
        () => UI.showScreen('screen-mode-select')
      );
      return;
    }

    if (result.exitedToMenu) {
      // Deliberate "Back to Modes" from the pause screen — not a catch,
      // not a win, just record stats and go straight back to mode select.
      PROGRESS.recordLevelResult(result);
      UI.showScreen('screen-mode-select');
      return;
    }

    if (result.success && (result.mode === 'story' || result.mode === 'custom' || result.mode === 'endless')) {
      PROGRESS.recordLevelResult(result);
      UI.refreshModeSelect();
      UI.showLevelComplete(result, selectedCharacter, () => handleCompleteNext(result), () => UI.showScreen('screen-mode-select'));
      return;
    }

    // Stealth / Chaos: still record stats for the story map's lifetime
    // totals, but route straight back to mode select rather than the
    // level-complete screen (those modes have no "next level" concept).
    PROGRESS.recordLevelResult(result);
    UI.showScreen('screen-mode-select');
  }

  // "Try Again" from the caught screen — retry the same run, the way each
  // mode's own "Try Again" already works elsewhere:
  //   story/endless — rebuild + re-intro the SAME level number (so
  //                    difficulty doesn't change), via restartCaughtLevel.
  //   custom        — replay the same form values, no VN intro.
  //   stealth       — no fixed "same level" concept, just start a fresh
  //                    random stealth run.
  function retrySameRun(result) {
    if (result.mode === 'custom') { beginCustomLevel(); return; }
    if (result.mode === 'stealth') { beginGeneratedLevel(randInt(1, 30), 'stealth'); return; }
    restartCaughtLevel(result);
  }

  // "Change Character" from the caught screen — back to character select
  // for the same mode (re-uses the same selection flow as mode select).
  function goToCharacterSelect() {
    UI.populateCharacterSelect((characterId) => {
      selectedCharacter = CHARACTERS[characterId];
      ASSETS.preloadCharacter(selectedCharacter).then(() => {
        afterCharacterChosen();
      });
    });
  }

  // Rebuilds the SAME level number (so difficulty doesn't change) and
  // shows a fresh VN intro before re-starting it. ui.js's showLevelIntro
  // already includes a DIALOGUE.level_failed_suspicion-style framing via
  // its own intro lines; the level number/character stay identical so it
  // reads as "the same situation, here's what happened, try again."
  function restartCaughtLevel(result) {
    const levelNumber = result.levelNumber || storyLevelNumber;
    beginGeneratedLevel(levelNumber, result.mode, true);
  }

  function handleCompleteNext(result) {
    if (result.mode === 'custom') {
      // Custom levels have no natural "next" — go back to the form.
      UI.showScreen('screen-mode-select');
      return;
    }

    const nextLevelNumber = result.levelNumber + 1;
    storyLevelNumber = nextLevelNumber;
    beginGeneratedLevel(nextLevelNumber, result.mode);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  APP.init();
});
