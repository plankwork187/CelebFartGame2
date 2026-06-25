/* ============================================================================
   ASSETS.JS — IMAGE PLACEHOLDER SYSTEM
   ============================================================================
   GOAL: let the whole game run and look reasonable with ZERO image files,
   and let you drop in real PNGs later WITHOUT touching any gameplay code.

   How it works:
     1. Every place in the game that wants an image calls
        ASSETS.resolve(path) instead of setting `img.src = path` directly.
     2. resolve() returns the real path if that file exists, otherwise it
        returns a generated placeholder data-URI (a simple colored shape
        with a text label) so broken-image icons never show up.
     3. Real-file detection is done once per path (cached) using a tiny
        Image() probe — after the first check, the result is reused.

   TO ADD REAL ART LATER:
     Just put PNGs at the paths referenced in data.js (e.g.
     "images/characters/stevie_body.png") and they will automatically be
     used instead of the placeholder — no code changes needed anywhere.

   The base folder for all image paths is IMAGE_BASE below.
   ========================================================================= */

const IMAGE_BASE = 'images/';

const ASSETS = (() => {
  const cache = new Map(); // path -> 'real' | 'missing' (resolution status)
  const placeholderCache = new Map(); // path -> data-uri string

  // Color palettes used to generate placeholder art so different
  // categories of image at least look visually distinct before real
  // art exists.
  const PLACEHOLDER_STYLES = {
    characters: { bg: '#F4D9B4', fg: '#7A4B2E', shape: 'person' },
    backgrounds: { bg: '#CFE8D8', fg: '#3C6B4F', shape: 'scene' },
    companions: { bg: '#D8CDEF', fg: '#5B3E8C', shape: 'person' },
    ui: { bg: '#FBE3E9', fg: '#E75480', shape: 'badge' },
    default: { bg: '#E5E5E5', fg: '#888888', shape: 'box' },
  };

  function styleFor(path) {
    if (path.includes('characters/')) return PLACEHOLDER_STYLES.characters;
    if (path.includes('backgrounds/')) return PLACEHOLDER_STYLES.backgrounds;
    if (path.includes('companions/')) return PLACEHOLDER_STYLES.companions;
    if (path.includes('ui/')) return PLACEHOLDER_STYLES.ui;
    return PLACEHOLDER_STYLES.default;
  }

  // Produces a short readable label from a path, e.g.
  // "characters/stevie_lean1.png" -> "stevie lean1"
  function labelFor(path) {
    const file = path.split('/').pop().replace(/\.[a-z0-9]+$/i, '');
    return file.replace(/_/g, ' ');
  }

  // Builds an inline SVG placeholder (as a data URI) so <img src="..."> can
  // use it directly with no extra DOM work. Shape varies a little by
  // category purely so things are easy to tell apart while testing.
  function buildPlaceholder(path) {
    if (placeholderCache.has(path)) return placeholderCache.get(path);
    const style = styleFor(path);
    const label = labelFor(path);
    const w = 240, h = 240;

    let shapeSvg = '';
    if (style.shape === 'person') {
      shapeSvg = `
        <circle cx="120" cy="80" r="38" fill="${style.fg}" opacity="0.55"/>
        <rect x="70" y="125" width="100" height="95" rx="18" fill="${style.fg}" opacity="0.55"/>`;
    } else if (style.shape === 'scene') {
      shapeSvg = `
        <rect x="0" y="150" width="240" height="90" fill="${style.fg}" opacity="0.35"/>
        <circle cx="190" cy="55" r="26" fill="${style.fg}" opacity="0.45"/>`;
    } else if (style.shape === 'badge') {
      shapeSvg = `<circle cx="120" cy="100" r="60" fill="${style.fg}" opacity="0.35"/>`;
    } else {
      shapeSvg = `<rect x="20" y="20" width="200" height="200" rx="14" fill="${style.fg}" opacity="0.25"/>`;
    }

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <rect width="${w}" height="${h}" fill="${style.bg}"/>
        ${shapeSvg}
        <text x="120" y="232" text-anchor="middle" font-family="sans-serif"
              font-size="11" fill="${style.fg}">${label}</text>
      </svg>`.trim();

    const dataUri = 'data:image/svg+xml,' + encodeURIComponent(svg);
    placeholderCache.set(path, dataUri);
    return dataUri;
  }

  // Probe whether a real file exists at this path. Returns a Promise that
  // resolves to true/false. Result is cached so we only probe once.
  function probe(fullPath) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = fullPath;
    });
  }

  // Preload a list of paths eagerly — probes each one in parallel and
  // warms the cache so that applyTo() / resolve() calls made after await
  // preloadAll() return the real path instantly with no placeholder flash.
  function preloadAll(paths) {
    const unique = [...new Set(paths.filter(Boolean))];
    return Promise.all(unique.map(path => {
      if (cache.has(path)) return Promise.resolve();
      return probe(IMAGE_BASE + path).then(exists => {
        cache.set(path, exists ? 'real' : 'missing');
      });
    }));
  }

  return {
    // Synchronous best-guess resolve: if we already know the answer,
    // return the right thing immediately. If we don't know yet, return
    // the placeholder now AND kick off a background probe; once the
    // probe resolves, call the optional onReady callback with the real
    // path so the caller can swap it in.
    resolve(path, onReady) {
      const fullPath = IMAGE_BASE + path;
      const known = cache.get(path);
      if (known === 'real') return fullPath;
      if (known === 'missing') return buildPlaceholder(path);

      // Unknown yet — probe in the background.
      probe(fullPath).then((exists) => {
        cache.set(path, exists ? 'real' : 'missing');
        if (exists && typeof onReady === 'function') onReady(fullPath);
      });
      return buildPlaceholder(path);
    },

    // Convenience helper: set an <img> element's src to the resolved
    // path, and silently upgrade it to the real image once available.
    applyTo(imgEl, path) {
      if (!path) { imgEl.removeAttribute('src'); return; }
      imgEl.src = this.resolve(path, (realPath) => {
        // Only swap if the element is still pointing at this logical path
        // (avoids race conditions if the element gets reused quickly).
        if (imgEl.dataset.assetPath === path) imgEl.src = realPath;
      });
      imgEl.dataset.assetPath = path;
    },

    // Convenience helper for CSS background-image usage.
    applyBackground(el, path) {
      if (!path) { el.style.backgroundImage = ''; return; }
      el.style.backgroundImage = `url("${this.resolve(path, (realPath) => {
        if (el.dataset.assetPath === path) el.style.backgroundImage = `url("${realPath}")`;
      })}")`;
      el.dataset.assetPath = path;
    },

    // Preload all image paths for a character so face swaps are instant.
    preloadCharacter(charDef) {
      if (!charDef) return Promise.resolve();
      const paths = [];
      if (charDef.profile) paths.push(charDef.profile);
      if (charDef.vn) paths.push(charDef.vn);
      if (charDef.body) paths.push(charDef.body);
      if (charDef.faces) {
        Object.values(charDef.faces).forEach(v => {
          if (Array.isArray(v)) v.forEach(p => paths.push(p));
          else if (v) paths.push(v);
        });
      }
      return preloadAll(paths);
    },

    // Preload all paths in a flat array.
    preloadPaths: preloadAll,
  };
})();
