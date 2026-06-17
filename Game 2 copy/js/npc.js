/* ============================================================================
   NPC.JS — NPC SPAWNING, MOVEMENT, AND DEPTH SYSTEM
   ============================================================================
   NPCs now live on one of three depth bands: 'foreground', 'midground',
   'background'. Each band has its own:
     - vertical position on screen (closer = lower/bigger, farther = higher/smaller)
     - scale (closer = bigger)
     - movement speed (closer NPCs appear to move faster — parallax feel)
     - detection sensitivity (closer NPCs notice smell/sound more easily)

   Depth is stored as a simple band string plus a 0..1 `depthT` value
   (0 = closest edge of the band, 1 = farthest edge) so we can smoothly
   scale/position within a band rather than only having 3 fixed slots.

   This file only manages the NPC entities themselves (creation, movement,
   removal). Detection/reaction logic that depends on clouds lives in
   cloud.js, which calls into npc.js's exported helpers.
   ========================================================================= */

const DEPTH_BANDS = {
  background:  { bottomPx: 210, scale: 0.55, speedMult: 0.5, detectionMult: 0.6, zIndex: 1 },
  midground:   { bottomPx: 165, scale: 0.75, speedMult: 0.75, detectionMult: 0.8, zIndex: 2 },
  foreground:  { bottomPx: 132, scale: 1.0,  speedMult: 1.0, detectionMult: 1.0, zIndex: 3 },
};

const NPC_COLORS = ['npc-A', 'npc-B', 'npc-C', 'npc-D'];

const NPC_SYSTEM = (() => {
  let npcs = [];
  let sceneEl = null;

  function init(sceneElement) {
    sceneEl = sceneElement;
    npcs = [];
  }

  function clear() {
    npcs.forEach(n => n.el.remove());
    npcs = [];
  }

  function getW() {
    return (sceneEl && sceneEl.clientWidth) || 680;
  }

  // Choose a depth band for a newly spawned NPC. `density` (0..1) from the
  // current level nudges the distribution toward more foreground (close,
  // dangerous) NPCs at higher density.
  function pickBand(density) {
    const items = [
      { value: 'background', weight: 1.2 - density * 0.4 },
      { value: 'midground', weight: 1.0 },
      { value: 'foreground', weight: 0.6 + density * 0.8 },
    ];
    return weightedChoice(items);
  }

  // Create one NPC and add it to the scene. `density` influences depth
  // band selection; `speedScale` lets game modes (e.g. chaos) speed
  // everyone up uniformly.
  function spawn(density = 0.5, speedScale = 1) {
    const band = pickBand(density);
    const meta = DEPTH_BANDS[band];
    const el = document.createElement('div');
    const type = randFrom(NPC_COLORS);
    el.className = `npc npc-depth-${band} ${type}`;
    const dir = Math.random() > 0.5 ? 1 : -1;
    const baseSpeed = (0.55 + Math.random() * 0.9) * meta.speedMult * speedScale;
    const W = getW();
    const startX = dir === 1 ? -60 : W + 60;

    el.style.bottom = meta.bottomPx + 'px';
    el.style.transform = `scale(${meta.scale})`;
    el.style.zIndex = String(meta.zIndex);
    el.innerHTML =
      '<div class="npc-head"></div>' +
      '<div class="npc-body"></div>' +
      '<div class="npc-legs"><div class="npc-leg"></div><div class="npc-leg"></div></div>' +
      '<div class="npc-react"></div>' +
      '<div class="npc-speech"></div>';
    el.style.left = startX + 'px';
    sceneEl.appendChild(el);

    const npc = {
      el, x: startX, dir, speed: baseSpeed, band, depthMeta: meta,
      reacted: false, id: Math.random().toString(36).slice(2),
    };
    npcs.push(npc);
    return npc;
  }

  function update(dt) {
    const W = getW();
    npcs = npcs.filter(n => {
      n.x += n.dir * n.speed;
      n.el.style.left = Math.round(n.x) + 'px';
      if (n.x < -100 || n.x > W + 100) { n.el.remove(); return false; }
      return true;
    });
  }

  function list() {
    return npcs;
  }

  return { init, clear, spawn, update, list, getW, DEPTH_BANDS };
})();
