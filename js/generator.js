/* ============================================================================
   GENERATOR.JS — PROCEDURAL LEVEL GENERATOR
   ============================================================================
   This is the core of Story Mode. Instead of handcrafted levels, every
   level is assembled from the variable pools in data.js, with numeric
   ranges that get harder as `levelNumber` increases.

   A "level definition" object looks like this (see buildLevel() below):
     {
       levelNumber, isEndless,
       location, time, companion, modifier,
       npcDensity, environmentNoise,
       gasPressureLevel, smellLevel, loudLevel,
       targetGas, timeLimitMs,
       difficultyScore
     }

   Nothing in this file touches the DOM. It only returns plain data. Game
   logic (game.js) and the level intro screen (ui.js) read this data and
   decide what to actually do with it. That separation is what makes it
   easy to test/tune the generator and easy to re-skin the presentation
   without breaking the numbers, or vice versa.
   ========================================================================= */

const GENERATOR = (() => {

  // ── Difficulty curve helpers ─────────────────────────────────────────
  // `t` is a 0..1 progress value across the 30-level campaign. Endless
  // mode keeps extrapolating t past 1 (see buildLevel below).
  function progressFor(levelNumber) {
    const CAMPAIGN_LENGTH = 30;
    return levelNumber / CAMPAIGN_LENGTH; // 1/30, 2/30 ... 30/30, 31/30...
  }

  // Returns a number that ramps from `start` to `end` over the campaign,
  // and keeps climbing slowly past level 30 for Endless Mode (capped).
  function rampValue(t, start, end, hardCap) {
    const eased = Math.min(1.35, t); // allow slight overshoot into endless
    let v = lerp(start, end, Math.min(1, eased));
    if (t > 1) {
      // Endless: keep nudging up slowly after the campaign ends.
      v += (t - 1) * (end - start) * 0.35;
    }
    if (hardCap !== undefined) v = Math.min(hardCap, v);
    return v;
  }

  // ── Variable selection ───────────────────────────────────────────────
  // Locations don't change in danger level themselves, but harder levels
  // bias toward locations with lower baseNoise (quieter = scarier) and
  // tighter depthBands as t increases, by weighting choices.
  function pickLocation(t) {
    const items = LOCATIONS.map(loc => {
      // Quieter locations become relatively more likely at high t.
      const quietBonus = (1 - loc.baseNoise) * t * 1.5;
      return { value: loc, weight: 1 + quietBonus };
    });
    return weightedChoice(items);
  }

  function pickTimeOfDay() {
    return randFrom(TIMES_OF_DAY);
  }

  // Companions appear starting around level 3, and become more likely
  // (and more often "difficult" companions) as difficulty increases.
  function pickCompanion(t, levelNumber) {
    if (levelNumber < 3) return COMPANIONS[0]; // 'none' for the first couple levels
    const chanceOfCompanion = clamp(0.25 + t * 0.5, 0.25, 0.85);
    if (Math.random() > chanceOfCompanion) return COMPANIONS[0];
    const realCompanions = COMPANIONS.filter(c => c.id !== 'none');
    return randFrom(realCompanions);
  }

  // 0-2 modifiers depending on difficulty; never more than 2 to keep
  // levels readable.
  function pickModifiers(t) {
    const none = MODIFIERS.find(m => m.id === 'none');
    const real = MODIFIERS.filter(m => m.id !== 'none');
    const count = Math.random() < clamp(0.2 + t * 0.5, 0.2, 0.7)
      ? (Math.random() < clamp(t * 0.4, 0, 0.4) ? 2 : 1)
      : 0;
    if (count === 0) return [none];
    const picked = [];
    const pool = real.slice();
    for (let i = 0; i < count && pool.length; i++) {
      const idx = randInt(0, pool.length - 1);
      picked.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return picked;
  }

  // ── Main builder ─────────────────────────────────────────────────────
  function buildLevel(levelNumber, options = {}) {
    const t = progressFor(levelNumber);

    const location = options.location || pickLocation(t);
    const time = options.time || pickTimeOfDay();
    const companion = options.companion || pickCompanion(t, levelNumber);
    const modifiers = options.modifiers || pickModifiers(t);

    // NPC density: 0..1, ramps up, modulated by time-of-day density bonus.
    let npcDensity = clamp(
      rampValue(t, 0.08, 0.85) + time.densityMod,
      0.1, 1
    );
    if (options.npcDensity !== undefined) npcDensity = options.npcDensity;

    // Environment noise: combination of location's base noise and a
    // small random variance, ramping slightly with difficulty (busier
    // venues as the campaign goes on).
    let environmentNoise = options.environmentNoise !== undefined
      ? options.environmentNoise
      : clamp(location.baseNoise + randRange(-0.05, 0.1) + t * 0.1, 0.02, 1);

    // Gas pressure level: how fast pressure builds / how much is in the
    // tank to start — ramps up so later levels demand faster decision
    // making.
    let gasPressureLevel = options.gasPressureLevel !== undefined
      ? options.gasPressureLevel
      : clamp(rampValue(t, 0.25, 0.75), 0.15, 1);

    // Smell and loudness are INDEPENDENT random rolls (per the design
    // requirement that they're separate mechanics), but their RANGES
    // widen with difficulty so high rolls become more likely/extreme.
    let smellLevel = options.smellLevel !== undefined
      ? options.smellLevel
      : clamp(randRange(0.15, rampValue(t, 0.15, 1)), 0.1, 1);

    let loudLevel = options.loudLevel !== undefined
      ? options.loudLevel
      : clamp(randRange(0.15, rampValue(t, 0.15, 1)), 0.1, 1);

    // Target gas to release this level — the win condition. Scales up
    // gently; later levels ask for more total output, not just harder
    // conditions.
    const targetGas = options.targetGas !== undefined
      ? options.targetGas
      : Math.round(rampValue(t, 60, 220));

    // Soft time limit in ms (purely a pacing tool — generous, not a hard
    // arcade timer). Endless mode keeps it roughly flat after campaign end.
    const timeLimitMs = options.timeLimitMs !== undefined
      ? options.timeLimitMs
      : Math.round(rampValue(t, 95000, 150000, 170000));

    // A single rolled-up difficulty score, mostly for UI display
    // ("Difficulty: 7/10") and for Endless Mode high-score comparisons.
    const difficultyScore = Math.round(
      clamp(
        (npcDensity * 2.2) +
        (gasPressureLevel * 1.8) +
        (smellLevel * 1.2) +
        (loudLevel * 1.2) +
        (modifiers.filter(m => m.id !== 'none').length * 0.8) +
        (companion.id !== 'none' ? 0.8 : 0) +
        (1 - environmentNoise) * 1.2,
        0, 10
      )
    );

    const reason = randFrom(location.flavorReasons);

    return {
      levelNumber,
      isEndless: levelNumber > 30,
      location,
      time,
      companion,
      modifiers,
      reason,
      npcDensity,
      environmentNoise,
      gasPressureLevel,
      smellLevel,
      loudLevel,
      targetGas,
      timeLimitMs,
      difficultyScore,
    };
  }

  return { buildLevel, progressFor, rampValue };
})();
