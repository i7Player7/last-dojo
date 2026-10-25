/* =========================================
   LAST DOJO V3 - SHARED CONFIG (config.js)
   Tuning lives here so balance changes don't
   require digging through engine code.
========================================= */

// ---------- Screen & world ----------
export const W = 1024;
export const H = 576;
export const WORLD_W = 2600;

export const HORIZON_Y = 92;        // where the sky band ends and the ground begins
export const FEET_MIN = 142;        // highest point an entity's feet can reach
export const FEET_MAX = H - 8;      // lowest point an entity's feet can reach

export const FOREST_END = 900;      // x < this is the forest (boars, caches, shade-dwellers)
export const SANCT_START = 1880;    // x > this is sacred ground (the dead can't enter)

// Dojo footprint (collision box at ground level). The building art rises above it.
export const DOJO = { x: 1240, y: 250, w: 160, h: 62 };
export const DOJO_DOOR = { x: DOJO.x + DOJO.w / 2, y: DOJO.y + DOJO.h + 14 };
export const DOJO_HP = 400;            // blood-moon siege health
export const DOJO_HIT_EVERY = 75;      // frames between a door-attacker's blows
export const SHRINE = { x: 2270, y: 336 };
// the stone that sealed Magatsuhi, in the courtyard beside the Dojo
export const SEAL = { x: 1150, y: 300 };
// the cooking pot beside the Dojo, where tonight's meal is prepared
export const POT = { x: DOJO.x + DOJO.w + 50, y: DOJO.y + DOJO.h + 22 };

export const STONE_LANTERNS = [
    { x: 1010, y: 236 }, { x: 1010, y: 470 },
    { x: 1640, y: 236 }, { x: 1640, y: 470 },
    { x: 1990, y: 270 }, { x: 1990, y: 430 },
    { x: 2420, y: 250 }
];

// ---------- Run structure ----------
export const SURVIVAL_DAYS = 15;
export const BLOOD_MOON_EVERY = 5;
export const DAY_LEN = 3600;        // 60s at 60fps
export const NIGHT_LEN = 4200;      // 70s

// ---------- Player tuning ----------
export const PLAYER = {
    hp: 100, stamina: 100, speed: 3.6, dmg: 20,
    punchCost: 10, spinCost: 32, dashCost: 18,
    staminaRegen: 0.9, staminaDelay: 20,
    dashFrames: 10, dashSpeed: 11.5, dashCd: 40,
    spinCd: 50, spinRadius: 78
};

// ---------- Food ----------
export const MEAT = { boar: 1, cache: 1 };     // per kill / per cache, before Butcher
// A meal cooked in the pot by day is eaten at dusk and lasts until dawn.
// Index = meat in the pot (0-3).
export const MEAL = {
    maxPot: 3,
    hp: [0, 10, 20, 30],                       // bonus max HP for the night
    regen: [0, 0, 0.15, 0.25],                 // bonus stamina recovery
    names: ['', 'Fed', 'Well fed', 'Feast']
};

// ---------- Dawn meditation ----------
// Essence burns away at sunrise; before it does, it can be spent here.
export const MEDITATE = { reroll: 2, fourth: 3, extraBase: 8, extraStep: 4 };

// ---------- Kegare (infection) ----------
export const KEGARE = {
    passivePerFrame: 0.00005,     // ~1 skull every 5.5 minutes on its own
    perEssenceCure: 0.5,          // each offered essence removes half a skull
    unleashCost: 0.35,
    unleashBlockAt: 2.6,
    surgeWarnFrames: 120,
    surgeStaggerFrames: 40,
    dmgPerSkull: 0.15,            // +15% damage per full skull (push-your-luck)
    sanctGrace: [480, 300, 180]   // frames before sacred ground starts burning, by skull count
};

// ---------- Enemies ----------
// hp/spd are day-1 values; normal enemies scale per day in game.js
export const ENEMY = {
    walker:  { hp: 50,   spd: 1.15, dmg: 10, keg: 0.05, size: 40, essence: 0.30, windup: 14, dojoDmg: 5 },
    runner:  { hp: 26,   spd: 2.35, dmg: 7,  keg: 0.04, size: 36, essence: 0.30, windup: 10, dojoDmg: 4 },
    brute:   { hp: 150,  spd: 0.75, dmg: 22, keg: 0.10, size: 52, essence: 1.00, windup: 24, dojoDmg: 12, kbRes: 0.25 },
    spitter: { hp: 36,   spd: 1.0,  dmg: 12, keg: 0.03, size: 40, essence: 1.00, windup: 20, dojoDmg: 3 },
    bloater: { hp: 55,   spd: 0.75, dmg: 18, keg: 0.08, size: 46, essence: 1.00, windup: 0,  dojoDmg: 20 },
    boar:    { hp: 70,   spd: 2.4,  dmg: 22, keg: 0,    size: 52, essence: 0,    windup: 0,  dojoDmg: 0 },
    alpha:   { hp: 1100, spd: 1.0,  dmg: 25, keg: 0.12, size: 72, essence: 0,    windup: 18, dojoDmg: 15, boss: true, kbRes: 0.05 },
    brood:   { hp: 750,  spd: 1.6,  dmg: 14, keg: 0.05, size: 60, essence: 0,    windup: 18, dojoDmg: 8,  boss: true, kbRes: 0.2 },
    warlord: { hp: 2600, spd: 1.25, dmg: 35, keg: 0.15, size: 84, essence: 0,    windup: 26, dojoDmg: 25, boss: true, kbRes: 0.1 }
};

export const BOSS_NAMES = {
    alpha: 'The Alpha',
    brood: 'The Broodmother',
    warlord: "Magatsuhi's Vessel"
};

// ---------- Dawn techniques ----------
// Each dawn offers one card from each group, so every choice is between kinds of strength.
export const TECH_GROUPS = ['attack', 'survival', 'utility'];
export const GROUP_LABELS = { attack: 'Attack', survival: 'Survival', utility: 'Movement & utility' };
export const TECHNIQUES = [
    { id: 'iron', group: 'attack',    name: 'Iron Fist',      max: 5, desc: 'Punches deal 20% more damage.' },
    { id: 'reach', group: 'attack',   name: 'Hurricane Reach', max: 3, desc: 'Spin Kick reaches 25% farther.' },
    { id: 'wind', group: 'survival',    name: 'Second Wind',    max: 4, desc: '+25 max stamina, and stamina recovers 20% faster.' },
    { id: 'swift', group: 'utility',   name: 'Swift Step',     max: 2, desc: 'Dash recharges 35% faster.' },
    { id: 'palm', group: 'attack',    name: 'Heavy Palm',     max: 1, desc: 'Every third punch stuns and sends foes flying.' },
    { id: 'vamp', group: 'survival',    name: 'Hungry Fist',    max: 3, desc: 'Heal 1 HP every time you land a hit.' },
    { id: 'skin', group: 'survival',    name: 'Iron Body',      max: 5, desc: '+25 max HP, and heal 25 now.' },
    { id: 'ward', group: 'survival',    name: 'Purity Breath',  max: 2, desc: 'Bites spread 30% less Kegare.' },
    { id: 'scav', group: 'utility',    name: 'Scavenger',      max: 3, desc: 'The dead drop essence and bandages more often.' },
    { id: 'riposte', group: 'utility', name: 'Wind Cutter',    max: 1, desc: 'Dashing through enemies cuts them for 25 damage.' },
    { id: 'calm', group: 'survival',    name: 'Still Mind',     max: 2, desc: 'Kegare creeps 40% slower on its own.' },
    { id: 'flow', group: 'utility',    name: 'Flowing Water',  max: 1, desc: 'Stamina keeps recovering while you attack.' },
    { id: 'frenzy', group: 'attack',  name: 'Oni Blood',      max: 1, desc: 'Unleash lasts 50% longer.' },
    { id: 'cyclone', group: 'attack', name: 'Cyclone',        max: 2, desc: 'Spin Kick recharges 35% faster.' },
    { id: 'butcher', group: 'utility', name: 'Butcher',        max: 1, desc: 'Boars and supply caches give 1 extra meat.' }
];

// ---------- First-time hints ----------
// [ACTION] tokens are replaced with the player's current key bindings.
export const HINTS = {
    start:     'Daylight keeps the horde away. Head west into the forest: break supply caches and hunt boars for meat.',
    boar:      'Boars shrug off punches. Press [DASH] to sidestep a charge so it crashes, then strike while it is dazed.',
    cache:     'Supply caches are guarded by shade-dwellers, dead that hide from the sun under the canopy. Lure them into the light.',
    dusk:      'Night falls and the dead come for you. Slain dead can drop Kegare essence.',
    essence:   'Essence: offer it at the Gekka Bijin in the far east at night to purge your Kegare, or press [UNLEASH] to burn it for power.',
    surge:     'A Kegare surge. Each skull makes you hit harder, but at three you turn. Purge it at the Gekka Bijin at night.',
    sanct:     'Sacred ground burns the Kegare inside you. The more tainted you are, the sooner it hurts.',
    bloodmoon: 'Blood moon: the horde tries to break through the Dojo doors. Hold the courtyard in front of them, and strike the dead to pull them toward you. Kill their champion to scatter them.',
    hurt:      'Low on health? Press [EAT] to eat meat, or rest at the Dojo door during the day.',
    rest:      'Resting at the Dojo door heals you and skips ahead to dusk. After a champion falls, you can also rest there until dawn.',
    meal:      'Cook tonight\'s meal: put up to 3 meat in the pot beside the Dojo. You eat it at dusk and fight stronger all night.',
    dawnburn:  'At sunrise, any essence you carry burns away. Spend it first: offer it at the flower, Unleash it, or use it in your dawn meditation.',
    forestdawn:'Dead caught in the forest at dawn hide under the canopy and guard it all day. Clear the forest at night to keep your hunting grounds safe.'
};

// ---------- Prologue ----------
// techniques the master has before the curse, and loses when it strikes
export const PROLOGUE_TECHS = ['iron', 'reach', 'palm', 'riposte'];

export const EPILOGUE = [
    "Magatsuhi's vessel is shattered.",
    'The seal holds.',
    'Sunlight turns the empty armor to ash...',
    '...and drives its essence back into the earth.',
    'It is not dead. Calamity never is.',
    'It will build a new body.',
    'But as long as you draw breath...',
    '...the Last Dojo stands ready.',
    'Endless mode unlocked.'
];
