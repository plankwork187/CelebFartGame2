/* ============================================================================
   CLOUD.JS — SMELL CLOUDS, LOUDNESS PULSES, AND NPC DETECTION
   ============================================================================
   SMELL and LOUDNESS are deliberately separate systems:

     SMELL (visible cloud)
       - spawns a persistent cloud entity that drifts, grows, and lingers
       - cloud size/duration/visibility scale with `smellLevel`
       - NPCs are "smell-detected" if they're within the cloud's radius,
         factoring in their depth band (closer NPCs are easier to smell)
       - lingering means a strong-smell cloud can still tag NPCs that
         walk through it well after the release happened

     LOUDNESS (instant pulse, no visible shape)
       - does NOT spawn a lingering cloud — it's a one-time "hearing radius"
         check the instant the release happens
       - NPCs within hearing radius react immediately regardless of depth
         band scale (sound travels independent of how "big" someone looks)
       - loudness causes a bigger immediate suspicion spike than smell,
         but does not linger

   Both systems read environment modifiers (MODIFIERS effects) so a
   level like "Stuffy Air" or "Construction Noise" can bias one or the
   other independently.
   ========================================================================= */

const CLOUD_SYSTEM = (() => {
  let clouds = [];
  let sceneEl = null;
  let playerWrapEl = null;
  let activeModifiers = [];
  let onNpcDetected = null; // callback(npc, info) set by game.js

  function init(sceneElement, playerWrapElement) {
    sceneEl = sceneElement;
    playerWrapEl = playerWrapElement;
    clouds = [];
  }

  function clear() {
    clouds.forEach(c => c.el.remove());
    clouds = [];
  }

  function setModifiers(mods) {
    activeModifiers = mods || [];
  }

  function setDetectionCallback(fn) {
    onNpcDetected = fn;
  }

  // Combine numeric modifier effects across all active modifiers for a
  // given effect key (multiplicative — defaults to 1 if none apply).
  function modEffect(key) {
    let mult = 1;
    activeModifiers.forEach(m => {
      if (m.effects && m.effects[key] !== undefined) mult *= m.effects[key];
    });
    return mult;
  }

  function getPlayerCenterX() {
    const playerRect = playerWrapEl.getBoundingClientRect();
    const sceneRect = sceneEl.getBoundingClientRect();
    return playerRect.left - sceneRect.left + playerRect.width / 2;
  }

  // ── SMELL: spawn a lingering visible cloud ─────────────────────────────
  // `smellLevel` (0..1) drives radius, duration, and opacity.
  // `power` (0..1) is the per-release power from the hold mechanic, which
  // still matters (a tiny nervous toot vs a full release), multiplied
  // together with the level's smellLevel.
  function spawnSmellCloud(dir, power, smellLevel) {
    const effectiveSmell = clamp(power * 0.5 + smellLevel * 0.5, 0, 1);
    const radius = (16 + effectiveSmell * 46) * modEffect('detectionRadiusMult');
    const el = document.createElement('div');
    el.className = 'cloud';
    el.style.width = el.style.height = Math.round(radius * 2) + 'px';
    el.style.background = effectiveSmell > 0.6
      ? 'rgba(180,220,80,0.55)'
      : 'rgba(200,230,120,0.38)';
    el.style.border = '1px solid rgba(140,180,40,0.4)';

    const baseX = getPlayerCenterX() - dir * 50;
    el.style.left = (baseX - radius) + 'px';
    el.style.bottom = '90px';
    el.style.fontSize = Math.round(10 + effectiveSmell * 8) + 'px';
    el.textContent = effectiveSmell > 0.7 ? '💨' : '';
    sceneEl.appendChild(el);

    const driftMult = modEffect('cloudDriftMult');
    const lifeMult = modEffect('cloudLifeMult');

    clouds.push({
      el, x: baseX, radius, drift: -dir, power: effectiveSmell,
      age: 0, maxAge: (1800 + effectiveSmell * 1800) * lifeMult,
      driftSpeed: 0.04 * (0.5 + effectiveSmell) * driftMult,
      detectedNpcIds: new Set(), // avoid re-triggering the same NPC every frame
    });
  }

  // ── LOUDNESS: instant hearing-radius pulse, no lingering shape ─────────
  // `loudLevel` (0..1) and `power` together determine hearing radius and
  // immediate suspicion. Distance falloff is linear within the radius.
  function emitLoudnessPulse(power, loudLevel, environmentNoise) {
    const effectiveLoud = clamp(power * 0.5 + loudLevel * 0.5, 0, 1);
    // Noisy environments shrink the effective hearing radius (masking).
    const noiseMask = clamp(1 - environmentNoise * 0.8, 0.25, 1);
    const hearingRadius = (40 + effectiveLoud * 220) * noiseMask * modEffect('hearingRadiusMult');

    const playerX = getPlayerCenterX();
    const hits = [];
    NPC_SYSTEM.list().forEach(n => {
      const dist = Math.abs(n.x - playerX);
      if (dist < hearingRadius) {
        const closeness = 1 - dist / hearingRadius; // 1 = right next to it, 0 = at the edge
        hits.push({ npc: n, closeness, source: 'loud' });
      }
    });
    return { hits, effectiveLoud, hearingRadius };
  }

  // ── Per-frame cloud update + smell detection check ─────────────────────
  function update(dt) {
    clouds = clouds.filter(c => {
      c.age += dt;
      c.x += c.drift * dt * c.driftSpeed;
      c.el.style.left = (c.x - c.radius) + 'px';
      c.el.style.opacity = String(Math.max(0, 1 - (c.age / c.maxAge) ** 2));
      checkSmellDetection(c);
      if (c.age >= c.maxAge) { c.el.remove(); return false; }
      return true;
    });
  }

  // Smell detection accounts for depth: NPCs farther back need the cloud
  // to be proportionally larger/closer to register (their detectionMult
  // from npc.js's DEPTH_BANDS scales the effective radius for them).
  // `closeness` (1 = right on top of the cloud center, 0 = at the very
  // edge of the effective radius) is passed along so game.js can apply
  // distance falloff to smell detections the same way it already does
  // for loudness hits.
  function checkSmellDetection(cloud) {
    const smellMaskMult = modEffect('smellDetectionMult');
    NPC_SYSTEM.list().forEach(n => {
      if (cloud.detectedNpcIds.has(n.id)) return;
      const effectiveRadius = (cloud.radius + 14) * n.depthMeta.detectionMult * smellMaskMult;
      const dist = Math.abs(n.x - cloud.x);
      if (dist < effectiveRadius) {
        cloud.detectedNpcIds.add(n.id);
        const closeness = clamp(1 - dist / effectiveRadius, 0, 1);
        if (onNpcDetected) onNpcDetected(n, { source: 'smell', power: cloud.power, closeness });
      }
    });
  }

  return {
    init, clear, setModifiers, setDetectionCallback,
    spawnSmellCloud, emitLoudnessPulse, update, modEffect,
  };
})();
