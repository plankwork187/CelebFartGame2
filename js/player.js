/* ============================================================================
   PLAYER.JS — LEANING, GAS PRESSURE, AND FACE REACTIONS
   ============================================================================
   This preserves the original game's core feel: hold a direction to lean
   and build up release power, longer hold = more power but more gas
   drained per second. Face reactions and dialogue react to gas/suspicion
   state, same as the base game, but now parameterized by the active
   level's gasPressureLevel so Story Mode can make pressure build faster
   or slower per level.
   ========================================================================= */

const PLAYER = (() => {
  let els = {};              // DOM element refs (set in init)
  let character = null;      // active CHARACTERS[id] entry
  let holdDir = 0, holdStart = 0, holdPower = 0;
  let currentFaceKey = null;
  let currentLeanImg = null;
  let cloudTimer = 0;
  let gas = 40;
  let gasFillRate = 0.010;   // overridden per-level via setGasPressureLevel
  let onRelease = null;      // callback(power) set by game.js
  let onInvoluntary = null;  // callback() set by game.js
  let suspendedByCut = false;

  const CIRC = 2 * Math.PI * 26;

  function init(domRefs) {
    els = domRefs;
  }

  function setCharacter(charDef) {
    character = charDef;
    ASSETS.applyTo(els.playerImg, character.body);
  }

  // gasPressureLevel: 0..1 from the level generator. Maps to how fast gas
  // refills passively (higher pressure level = faster, more urgent
  // refill, demanding more frequent releases).
  function setGasPressureLevel(level) {
    gasFillRate = lerp(0.006, 0.020, clamp(level, 0, 1));
  }

  function setCallbacks(cbs) {
    onRelease = cbs.onRelease || null;
    onInvoluntary = cbs.onInvoluntary || null;
  }

  // Helper: a face value can be a single path string or an array of paths
  // (Fix 3 doubled facecams). Pick one at random; skip if none available.
  function resolveFaceSrc(val) {
    if (!val) return null;
    if (Array.isArray(val)) {
      const valid = val.filter(Boolean);
      if (valid.length === 0) return null;
      return valid[Math.floor(Math.random() * valid.length)];
    }
    return val;
  }

  function getFaceMeta() {
    const F = character.faces;
    return {
      relaxed:   { src: F.disc_low, label: 'relaxed' },
      holding:   { src: F.disc_low, label: 'holding it...' },
      nervous:   { src: F.disc_low, label: 'nervous' },
      disc_high: { src: F.disc_high, label: 'pressure...' },
      lean1:     { src: F.lean1, label: 'farting...' },
      lean2:     { src: F.lean2, label: 'farting...' },
      lean_ext:  { src: F.lean_ext, label: 'Mmm finally...' },
      relieved:  { src: resolveFaceSrc(F.relief), label: 'phew!!! 😮\u200d💨' },
      panicking: { src: F.disc_high, label: 'panicking!!' },
      ohno:      { src: F.disc_high, label: 'oh no...' },
      caught1:   { src: F.caught1, label: 'CAUGHT!!' },
      caught2:   { src: F.caught2, label: 'BUSTED!!' },
      chaos:     { src: F.disc_high, label: 'Ugh, another one...' },
      sniffed:   { src: resolveFaceSrc(F.relief), label: 'hehe... 😏' },
    };
  }

  function setFace(key, force = false) {
    if (key === currentFaceKey && !force) return;
    currentFaceKey = key;
    const META = getFaceMeta();
    const m = META[key] || META.relaxed;
    // Fix 3: only apply if src is non-null (array faces may resolve to null
    // if no image is available yet — ASSETS skips missing files gracefully).
    if (m.src) ASSETS.applyTo(els.faceImg, m.src);
    els.faceLabel.textContent = m.label;
  }

  function reset(startGas = 40) {
    gas = startGas;
    holdDir = 0; holdPower = 0; cloudTimer = 0;
    currentFaceKey = null; currentLeanImg = null;
    els.playerWrap.className = '';
    els.powerRing.style.opacity = '0';
    els.powerArc.setAttribute('stroke-dasharray', '0 ' + CIRC);
    els.powerLabel.textContent = '';
    setFace('relaxed', true);
    AUDIO.stopLongFart(); // defensive: never carry a looping sound across a level reset
  }

  let chaosMode = false; // set by game.js via setChaosMode()

  function setChaosMode(enabled) {
    chaosMode = enabled;
  }

  let longFartStarted = false; // tracks whether the looping sound has begun this hold

  function startHold(dir) {
    if (!chaosMode && gas <= 0) return; // no gas left — can't start a fart
    holdDir = dir;
    holdStart = performance.now();
    longFartStarted = false; // reset for new hold
    els.powerRing.style.opacity = '1';
    currentLeanImg = Math.random() < 0.5 ? 'lean1' : 'lean2';
    setFace(currentLeanImg, true);
    // Long-fart sound starts in update() once power reaches HOLD_SOUND_THRESHOLD,
    // so it never overlaps with a tap/click sound (they are mutually exclusive).
  }

  function stopHold() {
    if (holdDir === 0) return null;
    const releasedPower = holdPower;
    els.playerWrap.className = '';
    els.powerRing.style.opacity = '0';
    els.powerArc.setAttribute('stroke-dasharray', '0 ' + CIRC);
    els.powerLabel.textContent = '';
    currentLeanImg = null;
    setFace('relieved', true);
    setTimeout(() => { if (holdDir === 0) currentFaceKey = null; }, 900);

    AUDIO.stopLongFart(); // always stop the charging loop on release
    // TAP_THRESHOLD: power below this counts as a quick tap/click rather
    // than a charged hold. Raised to 0.22 (matching the point at which
    // the long-fart sound begins playing) so only one sound plays — a
    // short press gets the click sound, a press that reaches 0.22 power
    // gets only the looping hold sound, never both.
    const TAP_THRESHOLD = 0.22;
    if (releasedPower < TAP_THRESHOLD) {
      AUDIO.playSmallFart();
      // Fix 5: short click releases a noticeable tuft of gas from the bar.
      if (!chaosMode) {
        gas = Math.max(0, gas - 18);
      }
    }

    if (onRelease) onRelease(releasedPower); // holdDir still set here — game.js reads it via getHoldDir()
    holdDir = 0; holdPower = 0;
    return releasedPower;
  }

  function isHolding() { return holdDir !== 0; }
  function getGas() { return gas; }
  function getHoldPower() { return holdPower; }
  function getHoldDir() { return holdDir; }

  function update(dt) {
    if (holdDir !== 0) {
      const elapsed = performance.now() - holdStart;
      holdPower = Math.min(1, elapsed / 3000);
      const arcLen = holdPower * CIRC;
      els.powerArc.setAttribute('stroke-dasharray', arcLen.toFixed(1) + ' ' + (CIRC - arcLen).toFixed(1));
      els.powerArc.setAttribute('stroke', holdPower > 0.7 ? '#cc2200' : holdPower > 0.4 ? '#e8a020' : '#E75480');
      els.powerLabel.textContent = holdPower > 0.7 ? 'MAX' : holdPower > 0.4 ? 'strong' : 'light';

      // Fix 5: start long-fart loop only once power crosses the click→hold
      // threshold (0.22), exactly matching the TAP_THRESHOLD in stopHold().
      // This guarantees the click sound and hold sound are mutually exclusive.
      const HOLD_SOUND_THRESHOLD = 0.22;
      if (!longFartStarted && holdPower >= HOLD_SOUND_THRESHOLD) {
        longFartStarted = true;
        AUDIO.startLongFart();
      }

      if (holdPower > 0.75) {
        els.playerWrap.className = holdDir === -1 ? 'lean-extreme-left' : 'lean-extreme-right';
        setFace('lean_ext', false);
      } else {
        els.playerWrap.className = holdDir === -1 ? 'lean-left' : 'lean-right';
        if (currentFaceKey !== currentLeanImg) setFace(currentLeanImg, true);
      }

      const drainRate = 0.004 + holdPower * holdPower * 0.014;
      gas = Math.max(0, gas - dt * drainRate);

      // Fix 2: if gas runs out mid-hold in non-chaos modes, force-release.
      if (!chaosMode && gas <= 0) {
        stopHold();
        return;
      }

      cloudTimer += dt;
      const interval = Math.max(140, 420 - holdPower * 280);
      if (cloudTimer >= interval) {
        cloudTimer = 0;
        if (onRelease) onRelease(holdPower, true); // true = "mid-hold puff", not a full release
      }
    } else {
      // Two-stage passive refill curve: faster through the first half of
      // the meter (0-50) so it's easy to get enough gas to release a
      // fart, then progressively slower through the second half (50-100)
      // so it's harder to accidentally fill all the way up and trigger an
      // involuntary release. FIRST_HALF_MULT/SECOND_HALF_MIN_MULT tune how
      // pronounced each stage is relative to the base gasFillRate.
      const FIRST_HALF_MULT = 1.35;     // speed multiplier while gas < 50
      const SECOND_HALF_MIN_MULT = 0.35; // multiplier gas approaches as it nears 100
      let rateMult;
      if (gas < 50) {
        rateMult = FIRST_HALF_MULT;
      } else {
        const t = clamp((gas - 50) / 50, 0, 1); // 0 at gas=50, 1 at gas=100
        rateMult = lerp(1, SECOND_HALF_MIN_MULT, t);
      }
      gas = Math.min(100, gas + dt * gasFillRate * rateMult);
    }

    if (!chaosMode && gas >= 100) {
      gas = Math.max(0, gas - 35);
      if (onInvoluntary) onInvoluntary();
    }
  }

  function updateIdleFace(suspicion) {
    if (holdDir !== 0) return;
    if (currentFaceKey === 'relieved') return;
    if (suspicion > 70)      setFace('panicking');
    else if (suspicion > 40) setFace('nervous');
    else if (gas > 78)       setFace('disc_high');
    else if (gas > 48)       setFace('holding');
    else                     setFace('relaxed');
  }

  return {
    init, setCharacter, setGasPressureLevel, setChaosMode, setCallbacks, reset,
    startHold, stopHold, isHolding, getGas, getHoldPower, getHoldDir, update,
    setFace, updateIdleFace,
  };
})();
