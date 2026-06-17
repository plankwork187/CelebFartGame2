/* ============================================================================
   COMPANION.JS — COMPANION MECHANICS
   ============================================================================
   A companion is a fixed NPC standing near the player who applies a
   unique gameplay rule for the level. Rules are looked up by the
   companion's `rule` key (see COMPANIONS in data.js) and implemented as
   small self-contained handlers below.

   Each rule handler can implement any of these optional lifecycle hooks:
     onStart(ctx)              - called once when the level begins
     onTick(ctx, dt)           - called every frame
     onPlayerRelease(ctx, info)- called whenever the player releases gas
                                 (info = { power, smellLevel, loudLevel })
     onSuspicionGain(ctx, amount) -> returns a possibly-modified amount
     getExtraHud(ctx)          - returns { label, value, max } for an
                                 extra HUD bar (e.g. Romance Meter), or null

   `ctx` is the small context object passed in from game.js, giving
   handlers access to things like setStatus(), the active level, etc.,
   without needing to import game.js directly (keeps this file standalone
   and easy to read top-to-bottom).
   ========================================================================= */

const COMPANION_RULES = {

  none: {}, // no special behavior

  // Best Friend: can absorb one detection per level by "covering" for you.
  covers_for_you: {
    onStart(ctx) {
      ctx.state.coverUsed = false;
    },
    onSuspicionGain(ctx, amount) {
      if (!ctx.state.coverUsed) {
        ctx.state.coverUsed = true;
        ctx.setStatus(`${ctx.companionName} loudly coughs to cover for you!`, 2200);
        return 0; // fully absorb this one detection
      }
      return amount;
    },
  },

  // Manager: smaller personal space bubble = higher base detection chance
  // while leaning (handled via a suspicion multiplier).
  watches_closely: {
    onSuspicionGain(ctx, amount) {
      return amount * 1.25;
    },
  },

  // Reporter: recording everything, so loud releases are riskier.
  records_everything: {
    onPlayerRelease(ctx, info) {
      if (info.loudLevel > 0.4) {
        ctx.setStatus(`${ctx.companionName}'s mic definitely picked that up...`, 2200);
      }
    },
    onSuspicionGain(ctx, amount, info) {
      if (info && info.source === 'loud') return amount * 1.4;
      return amount;
    },
  },

  // First Date: adds a Romance Meter HUD element that drops sharply on
  // any detection, and rises slowly over time if you stay clean.
  romance_meter: {
    onStart(ctx) {
      ctx.state.romance = 70;
    },
    onTick(ctx, dt) {
      ctx.state.romance = clamp(ctx.state.romance + dt * 0.0015, 0, 100);
    },
    onSuspicionGain(ctx, amount) {
      ctx.state.romance = clamp(ctx.state.romance - 22, 0, 100);
      return amount;
    },
    getExtraHud(ctx) {
      return { label: 'Romance', value: Math.round(ctx.state.romance), max: 100, key: 'romance' };
    },
  },

  // Director: periodically calls "Cut!" — a short window where any
  // release is far more noticeable (suspicion multiplier spikes).
  calls_cut: {
    onStart(ctx) {
      ctx.state.cutTimer = randRange(6000, 11000);
      ctx.state.cutActive = false;
    },
    onTick(ctx, dt) {
      ctx.state.cutTimer -= dt;
      if (ctx.state.cutTimer <= 0 && !ctx.state.cutActive) {
        ctx.state.cutActive = true;
        ctx.setStatus(`${ctx.companionName} yells "CUT!" — everyone is watching now.`, 2200);
        setTimeout(() => { ctx.state.cutActive = false; }, 2500);
        ctx.state.cutTimer = randRange(8000, 14000);
      }
    },
    onSuspicionGain(ctx, amount) {
      return ctx.state.cutActive ? amount * 2 : amount;
    },
  },

  // Security Guard: periodically sweeps the whole depth of the scene,
  // briefly boosting detection chance across all bands.
  patrol_sweep: {
    onStart(ctx) {
      ctx.state.sweepTimer = randRange(5000, 9000);
      ctx.state.sweepActive = false;
    },
    onTick(ctx, dt) {
      ctx.state.sweepTimer -= dt;
      if (ctx.state.sweepTimer <= 0 && !ctx.state.sweepActive) {
        ctx.state.sweepActive = true;
        ctx.setStatus(`${ctx.companionName} starts a slow sweep of the room...`, 2000);
        setTimeout(() => { ctx.state.sweepActive = false; }, 2200);
        ctx.state.sweepTimer = randRange(7000, 12000);
      }
    },
    onSuspicionGain(ctx, amount) {
      return ctx.state.sweepActive ? amount * 1.6 : amount;
    },
  },
};

const COMPANION_SYSTEM = (() => {
  let activeRule = COMPANION_RULES.none;
  let ctx = null;

  function init(companion, gameCtx) {
    activeRule = COMPANION_RULES[companion.rule] || COMPANION_RULES.none;
    ctx = gameCtx;
    ctx.state = ctx.state || {};
    ctx.companionName = companion.name;
    if (activeRule.onStart) activeRule.onStart(ctx);
  }

  function tick(dt) {
    if (activeRule.onTick) activeRule.onTick(ctx, dt);
  }

  function onPlayerRelease(info) {
    if (activeRule.onPlayerRelease) activeRule.onPlayerRelease(ctx, info);
  }

  // Pass a proposed suspicion gain through the companion's modifier (if
  // any). Returns the (possibly changed) amount to actually apply.
  function modifySuspicionGain(amount, info) {
    if (activeRule.onSuspicionGain) return activeRule.onSuspicionGain(ctx, amount, info);
    return amount;
  }

  function getExtraHud() {
    if (activeRule.getExtraHud) return activeRule.getExtraHud(ctx);
    return null;
  }

  return { init, tick, onPlayerRelease, modifySuspicionGain, getExtraHud };
})();
