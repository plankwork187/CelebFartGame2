/* ============================================================================
   AUDIO.JS — FART SOUND EFFECTS
   ============================================================================
   Two sound categories:
     SMALL_FARTS — short "tap" sounds. One is picked at random and played
                   once whenever the player does a quick tap/click release
                   (not a sustained hold).
     LONG_FARTS  — sustained "charging up" sounds. One is picked at random
                   and started (looping) the moment the player begins
                   holding a direction, and stopped the instant they
                   release the button. Meant to layer under the visual
                   power-ring charge-up.

   PLACEHOLDER FILES: the paths below do not need to exist yet — HTMLAudio
   fails silently (caught + logged, never throws into game logic) if a
   file 404s, so the rest of the game is unaffected until real files are
   dropped in at these paths. Replace the placeholder filenames with real
   ones later; no other code needs to change.

   USAGE (wired from player.js):
     AUDIO.startLongFart()  — call when a hold begins (PLAYER.startHold)
     AUDIO.stopLongFart()   — call when a hold ends (PLAYER.stopHold)
     AUDIO.playSmallFart()  — call on a quick tap release (short hold)
   ========================================================================= */

const SMALL_FARTS = [
  'audio/small1.mp3',
  'audio/small2.mp3',
  'audio/small3.mp3',
];

const LONG_FARTS = [
  'audio/long1.mp3',
  'audio/long2.mp3',
];

const AUDIO_BASE = 'audio/'; // currently unused since paths above already include it; kept for parity with ASSETS.IMAGE_BASE in case paths are simplified later

const AUDIO = (() => {
  let currentLong = null;       // the HTMLAudioElement currently looping for a held fart, or null
  let smallVolume = 0.85;
  let longVolume = 0.7;
  let muted = false;

  // Build (and cache) an Audio element for a given path. Failures (404,
  // unsupported format, autoplay-block, etc.) are swallowed — sound is a
  // nice-to-have, never a hard dependency for gameplay logic.
  function makeAudio(path, loop) {
    const el = new Audio(path);
    el.loop = !!loop;
    el.addEventListener('error', () => {
      // Placeholder file missing/broken — expected until real assets are
      // dropped in. Intentionally not thrown; gameplay must never depend
      // on audio succeeding.
    });
    return el;
  }

  function setMuted(value) {
    muted = !!value;
    if (muted && currentLong) {
      currentLong.pause();
    }
  }

  function setVolumes({ small, long } = {}) {
    if (typeof small === 'number') smallVolume = clamp(small, 0, 1);
    if (typeof long === 'number') longVolume = clamp(long, 0, 1);
  }

  // ── Small fart: quick one-shot, plays on a tap/click release ──────────
  function playSmallFart() {
    if (muted || !SMALL_FARTS.length) return;
    try {
      const path = randFrom(SMALL_FARTS);
      const el = makeAudio(path, false);
      el.volume = smallVolume;
      el.play().catch(() => { /* autoplay/decoding failure — ignore */ });
    } catch (e) { /* never let audio break gameplay */ }
  }

  // ── Long fart: looping, starts on hold-begin, stops on hold-release ───
  function startLongFart() {
    if (muted || !LONG_FARTS.length) return;
    stopLongFart(); // safety: never run two long farts at once
    try {
      const path = randFrom(LONG_FARTS);
      currentLong = makeAudio(path, true);
      currentLong.volume = longVolume;
      currentLong.play().catch(() => { /* autoplay/decoding failure — ignore */ });
    } catch (e) { /* never let audio break gameplay */ }
  }

  function stopLongFart() {
    if (!currentLong) return;
    try {
      currentLong.pause();
      currentLong.currentTime = 0;
    } catch (e) { /* ignore */ }
    currentLong = null;
  }

  return {
    playSmallFart, startLongFart, stopLongFart,
    setMuted, setVolumes,
  };
})();
