/* ============================================================================
   DATA.JS — ALL EDITABLE GAME CONTENT LIVES HERE
   ============================================================================
   This file is intentionally separate from the game logic. If you want to:
     - add a character              -> edit CHARACTERS
     - add a location                -> edit LOCATIONS
     - add a companion type          -> edit COMPANIONS
     - change/add dialogue lines     -> edit DIALOGUE
     - add a special modifier        -> edit MODIFIERS
     - change time-of-day options    -> edit TIMES_OF_DAY
   You should NOT need to touch generator.js, game.js, npc.js, cloud.js,
   or ui.js to add new content — just add entries to the lists below using
   the same shape as the existing entries.

   Nothing in this file references images directly by guessing filenames
   blindly — every image path goes through ASSETS (see assets.js), which
   falls back to a drawn placeholder if the PNG isn't there yet. So you can
   write new content here BEFORE you have art, and drop in PNGs later.
   ========================================================================= */


/* ----------------------------------------------------------------------
   CHARACTERS
   ----------------------------------------------------------------------
   Each character is an original mascot for this game (not a real person).
   `faces` keys must match the face states the game uses:
     disc_low, disc_high, lean1, lean2, lean_ext, relief, caught1, caught2
   `voiceName` is just used in dialogue text substitution if you want lines
   like "{name} sighs in relief."
   `personality` is a free-text hint used to flavor auto-generated VN lines
   for locations that don't have character-specific overrides.
------------------------------------------------------------------------- */
const CHARACTERS = {
  sabrina: {
    id: 'sabrina',
    name: 'Sabrina',
    tagline: 'Pop princess. Sweet smile, chaotic energy.',
    personality: 'playful, confident, always one step ahead of the situation',
    profile: 'characters/char1_profile.png',
    body: 'characters/char1_body.png',
    faces: {
      disc_low:  'characters/char1_disc_low.png',
      disc_high: 'characters/char1_disc_high.png',
      lean1:     'characters/char1_lean1.png',
      lean2:     'characters/char1_lean2.png',
      lean_ext:  'characters/char1_lean_ext.png',
      relief:    'characters/char1_relief.png',
      caught1:   'characters/char1_caught1.png',
      caught2:   'characters/char1_caught2.png',
    },
  },

  olivia: {
    id: 'olivia',
    name: 'Olivia',
    tagline: 'Sharp wit. Big feelings. Main-character momentum.',
    personality: 'expressive, determined, turns every setback into a dramatic story',
    profile: 'characters/char2_profile.png',
    body: 'characters/char2_body.png',
    faces: {
      disc_low:  'characters/char2_disc_low.png',
      disc_high: 'characters/char2_disc_high.png',
      lean1:     'characters/char2_lean1.png',
      lean2:     'characters/char2_lean2.png',
      lean_ext:  'characters/char2_lean_ext.png',
      relief:    'characters/char2_relief.png',
      caught1:   'characters/char2_caught1.png',
      caught2:   'characters/char2_caught2.png',
    },
  },

  ariana: {
    id: 'ariana',
    name: 'Ariana',
    tagline: 'Unshakable confidence. Every room becomes a stage.',
    personality: 'commanding, poised, effortlessly turns pressure into performance',
    profile: 'characters/char3_profile.png',
    body: 'characters/char3_body.png',
    faces: {
      disc_low:  'characters/char3_disc_low.png',
      disc_high: 'characters/char3_disc_high.png',
      lean1:     'characters/char3_lean1.png',
      lean2:     'characters/char3_lean2.png',
      lean_ext:  'characters/char3_lean_ext.png',
      relief:    'characters/char3_relief.png',
      caught1:   'characters/char3_caught1.png',
      caught2:   'characters/char3_caught2.png',
    },
  },
};


/* ----------------------------------------------------------------------
   LOCATIONS
   ----------------------------------------------------------------------
   Each location is a believable real-world setting. `bg` is the
   placeholder/real background image key (handled by assets.js).
   `baseNoise` (0-1) is the ambient noise level of the place itself BEFORE
   any modifiers are applied — noisy places (food courts) mask loudness;
   quiet places (libraries) make loudness much riskier.
   `depthBands` describes how NPC lanes are laid out for this location
   (some places are long and thin, others are wide and shallow).
   `flavorReasons` are reasons the character might be there — used by the
   procedural VN intro screen.
------------------------------------------------------------------------- */
const LOCATIONS = [
  {
    id: 'library',
    name: 'Public Library',
    bg: 'backgrounds/library.png',
    seat: 'seats/library_seat.png',
    baseNoise: 0.05,
    depthBands: { foreground: 1.0, midground: 0.8, background: 0.5 },
    flavorReasons: [
      'returning an overdue book before the fine doubles',
      'pretending to study for an important event',
      'doing research for a group project',
      'looking for a quiet place to read',
    ],
  },
  {
    id: 'movie_theater',
    name: 'Movie Theater',
    bg: 'backgrounds/movie_theater.png',
    seat: 'seats/movie_theater_seat.png',
    baseNoise: 0.55,
    depthBands: { foreground: 1.0, midground: 1.0, background: 0.9 },
    flavorReasons: [
      'seeing the midnight premiere everyone is talking about',
      'five dollar movie tuesdays',
      'finding a spot with two hours of AC on a hot day',
      'watching the new horror flick everyone is raving about',
    ],
  },
  {
    id: 'grocery_store',
    name: 'Grocery Store',
    bg: 'backgrounds/grocery_store.png',
    seat: 'seats/grocery_store_seat.png',
    baseNoise: 0.35,
    depthBands: { foreground: 1.0, midground: 0.9, background: 0.7 },
    flavorReasons: [
      'doing the weekly shop',
      'just grabbing one thing, in and out',
      'avoiding the self-checkout line',
      'sampling literally everything at the free-sample table',
    ],
  },
  {
    id: 'restaurant',
    name: 'Restaurant',
    bg: 'backgrounds/restaurant.png',
    seat: 'seats/restaurant_seat.png',
    baseNoise: 0.4,
    depthBands: { foreground: 1.0, midground: 0.85, background: 0.6 },
    flavorReasons: [
      'celebrating a promotion',
      'an awkward first date',
      'family dinner that is already going badly',
      'expensing this meal and regretting the order',
    ],
  },
  {
    id: 'classroom',
    name: 'Classroom',
    bg: 'backgrounds/classroom.png',
    seat: 'seats/classroom_seat.png',
    baseNoise: 0.2,
    depthBands: { foreground: 1.0, midground: 0.85, background: 0.6 },
    flavorReasons: [
      'taking a surprise pop quiz',
      'giving a presentation in ten minutes',
      'trying to stay awake in the back row',
      'subbing in for a class you know nothing about',
    ],
  },
  {
    id: 'backstage',
    name: 'Backstage Area',
    bg: 'backgrounds/backstage.png',
    seat: 'seats/backstage_seat.png',
    baseNoise: 0.3,
    depthBands: { foreground: 1.0, midground: 0.75, background: 0.5 },
    flavorReasons: [
      'minutes from walking on stage',
      'waiting for a costume change',
      'rehearsing lines one last time',
      'hiding from the director after a mistake',
    ],
  },
  {
    id: 'interview_room',
    name: 'Job Interview',
    bg: 'backgrounds/interview_room.png',
    seat: 'seats/interview_room_seat.png',
    baseNoise: 0.05,
    depthBands: { foreground: 1.0, midground: 0.6, background: 0.3 },
    flavorReasons: [
      'interviewing for a dream job',
      'a panel interview with three people staring at you',
      'a follow-up interview after a strong first round',
      'interviewing for a job you are wildly unqualified for',
    ],
  },
  {
    id: 'waiting_room',
    name: 'Waiting Room',
    bg: 'backgrounds/waiting_room.png',
    seat: 'seats/waiting_room_seat.png',
    baseNoise: 0.15,
    depthBands: { foreground: 1.0, midground: 0.8, background: 0.55 },
    flavorReasons: [
      'waiting for a doctor running 40 minutes late',
      'waiting to hear your name called at the DMV',
      'sitting in on a friend\'s appointment',
      'killing time before a meeting upstairs',
    ],
  },
  {
    id: 'music_video_set',
    name: 'Music Video Set',
    bg: 'backgrounds/music_video_set.png',
    seat: 'seats/music_video_set_seat.png',
    baseNoise: 0.5,
    depthBands: { foreground: 1.0, midground: 0.9, background: 0.8 },
    flavorReasons: [
      'star of the show',
      'filming her new music video',
      'location scouting for her next shoot',
      'on the side of set taking a break between shots',
    ],
  },
  {
    id: 'office',
    name: 'Open-Plan Office',
    bg: 'backgrounds/office.png',
    seat: 'seats/office_seat.png',
    baseNoise: 0.3,
    depthBands: { foreground: 1.0, midground: 0.85, background: 0.65 },
    flavorReasons: [
      'a quarterly review meeting',
      'covering someone else\'s desk for the day',
      'the first week at a new job',
      'an all-hands meeting that is running long',
    ],
  },
  {
    id: 'elevator',
    name: 'Crowded Elevator',
    bg: 'backgrounds/elevator.png',
    seat: 'seats/elevator_seat.png',
    baseNoise: 0.1,
    depthBands: { foreground: 1.0, midground: 0.5, background: 0.2 },
    flavorReasons: [
      'stuck between floors with the building\'s slowest elevator',
      'riding up forty-two floors with strangers',
      'sharing the ride with the entire executive team',
      'just trying to make it to the lobby',
    ],
  },
  {
    id: 'airplane',
    name: 'Airplane Cabin',
    bg: 'backgrounds/airplane.png',
    seat: 'seats/airplane_seat.png',
    baseNoise: 0.45,
    depthBands: { foreground: 1.0, midground: 0.8, background: 0.6 },
    flavorReasons: [
      'a middle seat on a five-hour flight',
      'flying home for the holidays',
      'a turbulent red-eye flight',
      'seated next to a chatty stranger',
    ],
  },
  {
    id: 'wedding',
    name: 'Wedding Reception',
    bg: 'backgrounds/wedding.png',
    seat: 'seats/wedding_seat.png',
    baseNoise: 0.5,
    depthBands: { foreground: 1.0, midground: 0.9, background: 0.75 },
    flavorReasons: [
      'a cousin\'s wedding with an open bar',
      'giving the best man speech in ten minutes',
      'seated at the worst table by the speakers',
      'the bouquet toss is about to happen',
    ],
  },
  {
    id: 'gym',
    name: 'Gym Class',
    bg: 'backgrounds/gym.png',
    seat: 'seats/gym_seat.png',
    baseNoise: 0.4,
    depthBands: { foreground: 1.0, midground: 0.85, background: 0.65 },
    flavorReasons: [
      'mid-workout at a packed gym',
      'a yoga class that is way too quiet',
      'spotting a friend on the bench press',
      'stuck doing burpees in front of everyone',
    ],
  },
];


/* ----------------------------------------------------------------------
   TIMES OF DAY
   ----------------------------------------------------------------------
   Mostly flavor text + a small lighting tint applied to the scene, but
   also nudges baseline NPC density (busier at lunch/evening peaks).
------------------------------------------------------------------------- */
const TIMES_OF_DAY = [
  { id: 'early_morning', name: 'Early Morning', tint: 'rgba(120,140,200,0.18)', densityMod: -0.15 },
  { id: 'morning',       name: 'Morning',       tint: 'rgba(255,240,200,0.10)', densityMod: 0 },
  { id: 'midday',        name: 'Midday',        tint: 'rgba(255,255,255,0.0)',  densityMod: 0.15 },
  { id: 'afternoon',     name: 'Afternoon',     tint: 'rgba(255,220,150,0.08)', densityMod: 0.05 },
  { id: 'evening',       name: 'Evening',       tint: 'rgba(180,120,180,0.16)', densityMod: 0.1 },
  { id: 'late_night',    name: 'Late Night',    tint: 'rgba(20,20,60,0.30)',    densityMod: -0.25 },
];


/* ----------------------------------------------------------------------
   COMPANIONS
   ----------------------------------------------------------------------
   A companion is an NPC who is ALWAYS near the player (not roaming).
   `rule` is a short machine key that game.js / npc.js checks to apply a
   unique gameplay twist for that companion (see COMPANION_RULES in
   companion.js). `dialogueKey` looks up extra VN lines in DIALOGUE.companions.
------------------------------------------------------------------------- */
const COMPANIONS = [
  {
    id: 'none',
    name: 'No one',
    rule: 'none',
    portrait: null,
    description: 'Flying solo this time.',
  },
  {
    id: 'friend',
    name: 'Best Friend',
    rule: 'covers_for_you',
    portrait: 'companions/friend.png',
    description: 'Stands closer than anyone else, but will cover for you once per level by loudly coughing.',
  },
  {
    id: 'manager',
    name: 'Manager',
    rule: 'watches_closely',
    portrait: 'companions/manager.png',
    description: 'Has an unusually small personal-space bubble and a higher chance of noticing you mid-lean.',
  },
  {
    id: 'reporter',
    name: 'Reporter',
    rule: 'records_everything',
    portrait: 'companions/reporter.png',
    description: 'Recording a microphone the whole time — loud releases are far riskier than usual.',
  },
  {
    id: 'date',
    name: 'First Date',
    rule: 'romance_meter',
    portrait: 'companions/date.png',
    description: 'There is a Romance Meter alongside Suspicion. Getting caught tanks it instantly.',
  },
  {
    id: 'director',
    name: 'Director',
    rule: 'calls_cut',
    portrait: 'companions/director.png',
    description: 'Periodically yells "Cut!" — a brief freeze where any release is far more noticeable.',
  },
  {
    id: 'security_guard',
    name: 'Security Guard',
    rule: 'patrol_sweep',
    portrait: 'companions/security_guard.png',
    description: 'Periodically does a slow sweeping glance across the whole depth of the scene.',
  },
];


/* ----------------------------------------------------------------------
   SPECIAL MODIFIERS
   ----------------------------------------------------------------------
   Environmental modifiers layered on top of a level to add variety.
   `apply` keys are read by generator.js / game.js to adjust numbers.
   Keep modifiers additive/multiplicative and self-contained so any
   combination of modifiers is safe to stack.
------------------------------------------------------------------------- */
const MODIFIERS = [
  {
    id: 'none',
    name: 'Nothing unusual',
    description: 'A perfectly normal day. Somehow that is rare.',
    effects: {},
  },
  {
    id: 'draft',
    name: 'Strong Draft',
    description: 'An open window or vent means clouds drift and dissipate much faster.',
    effects: { cloudDriftMult: 1.8, cloudLifeMult: 0.6 },
  },
  {
    id: 'stuffy',
    name: 'Stuffy Air',
    description: 'No airflow at all. Smell lingers far longer than usual.',
    effects: { cloudDriftMult: 0.35, cloudLifeMult: 1.7, detectionRadiusMult: 1.25 },
  },
  {
    id: 'perfume_counter',
    name: 'Heavy Perfume',
    description: 'Strong ambient smell everywhere — it partially masks yours.',
    effects: { smellDetectionMult: 0.7 },
  },
  {
    id: 'construction',
    name: 'Construction Noise',
    description: 'Loud background noise outside masks how far your sound travels.',
    effects: { hearingRadiusMult: 0.55 },
  },
  {
    id: 'silent_room',
    name: 'Dead Silent Room',
    description: 'You could hear a pin drop. Loudness is extremely risky here.',
    effects: { hearingRadiusMult: 1.8, suspicionFromSoundMult: 1.4 },
  },
  {
    id: 'tight_quarters',
    name: 'Tight Quarters',
    description: 'Everyone is packed close together — depth barely helps you hide.',
    effects: { depthProtectionMult: 0.4 },
  },
  {
    id: 'spacious',
    name: 'Spacious Layout',
    description: 'Lots of room to spread out. Distance is your friend here.',
    effects: { depthProtectionMult: 1.6 },
  },
  {
    id: 'allergies',
    name: 'Everyone Has Allergies',
    description: 'The whole room is already sniffling and rubbing their eyes — small mercy, it is harder to tell what is you.',
    effects: { smellDetectionMult: 0.8, suspicionDecayMult: 1.2 },
  },
  {
    id: 'tense_silence',
    name: 'Tense Silence',
    description: 'Something awkward just happened and nobody is talking. Every sound stands out.',
    effects: { hearingRadiusMult: 1.4, suspicionFromSoundMult: 1.25 },
  },
];


/* ----------------------------------------------------------------------
   DIALOGUE
   ----------------------------------------------------------------------
   All in-game text lives here so it's trivial to localize, rewrite, or
   expand without touching logic. Most pools are plain arrays (one picked
   at random). VN intro lines use {placeholders} filled in by
   generator.js / ui.js — see fillTemplate() in utils.js.
------------------------------------------------------------------------- */
const DIALOGUE = {
  // Pre-existing in-scene status lines (kept from the base game, expanded)
  holding: [
    "Ok... just hold it together...",
    "Not now, not now, NOT NOW...",
    "My stomach is staging a revolt.",
    "This is fine. Everything is fine.",
    "I shouldn't have had that for lunch.",
    "The pressure is... immense.",
    "I am in full negotiation with my gut.",
    "Stay calm. Stay calm. Stay CALM.",
    "Body: release. Brain: not yet.",
    "Internal weather report: severe turbulence.",
    "The volcano shall not erupt today.",
    "Clenching with the power of a thousand suns.",
  ],
  leaning: [
    "Ok... angle of attack: confirmed.",
    "Lean it out, lean it out...",
    "Directional release commencing...",
    "Strategic tilt engaged. 🎯",
    "Rotating for optimal dispersal.",
    "This is a precision operation.",
    "The lean of shame begins.",
    "Casually adjusting... yes... just stretching.",
    "Nobody suspects the lean.",
  ],
  release: [
    "......... did anyone hear that?",
    "Silent but deadly. As planned.",
    "Mission accomplished 💨",
    "Like a whisper in the wind.",
    "That one had RANGE.",
    "Nature has been answered.",
    "And the pressure... is gone. 😮‍💨",
    "Perfectly executed. No witnesses.",
    "The atmosphere has been... altered.",
    "That was a 9.2 on the Richter scale.",
  ],
  suspicious: [
    "That person is sniffing the air... abort!",
    "Why are they looking around like that??",
    "They definitely smelled it. Scanning the room.",
    "Play it cool. You're just standing here.",
    "They know. They all know.",
    "Someone is doing the smell face.",
    "Innocent face. Innocent face. INNOCENT FACE.",
    "Act natural. ACT. NATURAL.",
    "Why is everyone suddenly so alert?",
  ],
  caught: [
    "I have never been so humiliated... and relieved.",
    "The whole room heard that one. And smelled it.",
    "This spot may never recover.",
    "That was NOT the wind.",
    "I may have made a new hole in the ozone layer with that one...",
    "What? It's natural, y'know!",
  ],
  involuntary: [
    "NO NO NO NO—",
    "The body has betrayed me!!",
    "TRAITOR!! My own stomach!!",
    "That was NOT authorized!!",
    "EMERGENCY DEPLOYMENT!!",
    "Unsanctioned release! Abort! ABORT!",
    "My gut went rogue!!",
  ],
  chaos: [
    "Maximum output! No holding back!",
    "This is my gift to the world 💨",
    "Let 'em have it!! ALL OF THEM!!",
    "Scorched earth policy activated.",
    "Releasing the Kraken.",
    "Strategic weapons grade flatulence.",
  ],
  hit: [
    "Bullseye! 🎯 Direct hit!",
    "Got one!! The wind carries my legacy.",
    "They walked RIGHT into it. Amateurs.",
    "Combo! Keep going!!",
    "Nobody can escape the cloud.",
  ],
  npc_mild: [
    "Hm...", "Is it just me...?", "...weird.", "Something's off.", "Hmm... odd.", "What's that smell?",
  ],
  npc_medium: [
    "What is that smell?", "Who did that?", "Ugh... seriously?", "Ok who was it?",
    "That's... not great.", "Oh come ON.", "Something smells off...",
  ],
  npc_strong: [
    "What IS that?!", "OH MY GOD.", "That is absolutely FOUL.", "WHO DID THAT?!",
    "I— I need to move.", "My eyes are watering!!", "What DIED in here?!",
  ],
  npc_chaos: [
    "I'm going to be SICK.", "EVACUATE. NOW.", "My lungs!! MY LUNGS!!",
    "Someone call for help!!", "GET OUT GET OUT GET OUT",
  ],

  // ── Story Mode level intro (visual novel) lines ────────────────────────
  // {character}, {location}, {reason}, {time}, {companion} are filled in.
  vn_intro_opening: [
    "{character} takes a slow breath. {location}, {time}. {reason}. What could go wrong?",
    "Here we are again: {location}, {time}, {reason}. {character} feels something stirring.",
    "{character} arrives at {location} {time} — {reason}. It is already starting.",
    "{time} at {location}. {reason}. {character}'s stomach has other plans.",
  ],
  vn_intro_opening_retry: [
    "Busted last time. {character} is back at {location}, {time}, {reason} — same situation, but this time they know what gave them away.",
    "Caught red-handed. {character} takes a breath and steps back into {location}, {time}, {reason}. No more mistakes.",
    "That one got noticed fast. {character} resets at {location}, {time}, {reason}, determined to be more careful this time.",
  ],
  vn_intro_companion_none: [
    "No one else to worry about. Just {character} and a building sense of dread.",
    "Alone, for once. That should make this easier. Should.",
  ],
  vn_intro_companion_present: [
    "{companionName} is right there. This complicates things considerably.",
    "Of all days for {companionName} to stick close, it's today.",
    "{companionName} has no idea what is about to happen.",
  ],
  vn_intro_pressure_low: [
    "It's manageable. For now.",
    "Just a light rumble. Nothing {character} can't handle.",
  ],
  vn_intro_pressure_mid: [
    "The pressure is building faster than expected.",
    "This is going to need a release plan, and soon.",
  ],
  vn_intro_pressure_high: [
    "This is already critical. {character} may not last five minutes.",
    "Code red. The gas pressure is already near the danger zone.",
  ],
  vn_intro_smell_warning: [
    "Whatever this is, it is going to smell catastrophic.",
    "{character} can already tell: this one will linger.",
  ],
  vn_intro_loud_warning: [
    "And it is going to be LOUD. There's no muffling this one.",
    "Quiet release is not an option today — this one has volume.",
  ],
  vn_intro_modifier: [
    "One more thing: {modifierName}. {modifierDescription}",
  ],
  vn_intro_closing: [
    "Goal: release {targetGas} hundred mL of gas without getting caught. Good luck.",
    "Target: vent {targetGas} hundred mL of gas. Stay smooth. Stay invisible.",
  ],

  // ── Companion-specific extra lines ──────────────────────────────────────
  companions: {
    covers_for_you: [
      "{companionName}: \"Don't worry, I've got your back. Once.\"",
    ],
    watches_closely: [
      "{companionName} keeps glancing over. Way too often.",
    ],
    records_everything: [
      "{companionName} checks the mic levels. Everything is being recorded.",
    ],
    romance_meter: [
      "{companionName} smiles. {character} smiles back, sweating slightly.",
    ],
    calls_cut: [
      "{companionName}: \"Quiet on set! And... action.\"",
    ],
    patrol_sweep: [
      "{companionName} adjusts an earpiece and starts scanning the room.",
    ],
  },

  // ── Level complete / fail flavor ─────────────────────────────────────────
  level_complete: [
    "Mission complete. Nobody suspects a thing.",
    "Target hit. {character} walks away scot-free.",
    "Textbook execution. On to the next one.",
  ],
  level_failed_suspicion: [
    "Busted. {character} did not see that coming.",
    "Caught red-handed. Or red-faced, anyway.",
  ],
};
