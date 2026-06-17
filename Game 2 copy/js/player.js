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
      relieved:  { src: F.relief, label: 'phew!!! 😮\u200d💨' },
      panicking: { src: F.disc_high, label: 'panicking!!' },
      ohno:      { src: F.disc_high, label: 'oh no...' },
      caught1:   { src: F.caught1, label: 'CAUGHT!!' },
      caught2:   { src: F.caught2, label: 'BUSTED!!' },
      chaos:     { src: F.disc_high, label: 'Ugh, another one...' },
      sniffed:   { src: F.relief, label: 'hehe... 😏' },
    };
  }

  function setFace(key, force = false) {
    if (key === currentFaceKey && !force) return;
    currentFaceKey = key;
    const META = getFaceMeta();
    const m = META[key] || META.relaxed;
    ASSETS.applyTo(els.faceImg, m.src);
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
  }

  function startHold(dir) {
    if (gas <= 1) return;
    holdDir = dir;
    holdStart = performance.now();
    els.powerRing.style.opacity = '1';
    currentLeanImg = Math.random() < 0.5 ? 'lean1' : 'lean2';
    setFace(currentLeanImg, true);
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
      if (gas <= 0) { stopHold(); return; }
      const elapsed = performance.now() - holdStart;
      holdPower = Math.min(1, elapsed / 3000);
      const arcLen = holdPower * CIRC;
      els.powerArc.setAttribute('stroke-dasharray', arcLen.toFixed(1) + ' ' + (CIRC - arcLen).toFixed(1));
      els.powerArc.setAttribute('stroke', holdPower > 0.7 ? '#cc2200' : holdPower > 0.4 ? '#e8a020' : '#E75480');
      els.powerLabel.textContent = holdPower > 0.7 ? 'MAX' : holdPower > 0.4 ? 'strong' : 'light';

      if (holdPower > 0.75) {
        els.playerWrap.className = holdDir === -1 ? 'lean-extreme-left' : 'lean-extreme-right';
        setFace('lean_ext', false);
      } else {
        els.playerWrap.className = holdDir === -1 ? 'lean-left' : 'lean-right';
        if (currentFaceKey !== currentLeanImg) setFace(currentLeanImg, true);
      }

      const drainRate = 0.004 + holdPower * holdPower * 0.014;
      gas = Math.max(0, gas - dt * drainRate);

      cloudTimer += dt;
      const interval = Math.max(140, 420 - holdPower * 280);
      if (cloudTimer >= interval) {
        cloudTimer = 0;
        if (onRelease) onRelease(holdPower, true); // true = "mid-hold puff", not a full release
      }
    } else {
      const proximity = Math.max(0, (gas - 85) / 15);
      const rate = gasFillRate * (1 - proximity * 0.82);
      gas = Math.min(100, gas + dt * rate);
    }

    if (gas >= 100) {
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
    init, setCharacter, setGasPressureLevel, setCallbacks, reset,
    startHold, stopHold, isHolding, getGas, getHoldPower, getHoldDir, update,
    setFace, updateIdleFace,
  };
})();
