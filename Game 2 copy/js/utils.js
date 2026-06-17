/* ============================================================================
   UTILS.JS — SMALL SHARED HELPER FUNCTIONS
   ============================================================================
   Generic helpers with no game-specific knowledge. If a function doesn't
   need to know about gas, NPCs, or levels, it belongs here.
   ========================================================================= */

// Pick a random element from an array.
function randFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Random float in [min, max).
function randRange(min, max) {
  return min + Math.random() * (max - min);
}

// Random integer in [min, max] inclusive.
function randInt(min, max) {
  return Math.floor(randRange(min, max + 1));
}

// Clamp a number between lo and hi.
function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// Linear interpolation.
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Fill a "{placeholder}" style template string using a data object.
// Example: fillTemplate("Hi {name}!", { name: "Stevie" }) -> "Hi Stevie!"
function fillTemplate(str, data) {
  return str.replace(/\{(\w+)\}/g, (match, key) => {
    return (key in data) ? data[key] : match;
  });
}

// Pick a random line from a DIALOGUE pool and fill in template data.
function randLine(pool, data = {}) {
  return fillTemplate(randFrom(pool), data);
}

// Weighted random choice. `items` is an array of { value, weight }.
function weightedChoice(items) {
  const total = items.reduce((sum, it) => sum + it.weight, 0);
  let roll = Math.random() * total;
  for (const it of items) {
    if (roll < it.weight) return it.value;
    roll -= it.weight;
  }
  return items[items.length - 1].value;
}
