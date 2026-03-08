// ═══════════════════════════════════════════════════════
// CHARACTER ROSTER — 12 Unique Fighters
// ═══════════════════════════════════════════════════════

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  color: string;       // primary armor/outfit color
  color2: string;      // secondary/accent color
  skin: string;
  hair: string;
  weaponKey: string;
  specialType: string;
  specialName: string;
  specialColor: string;
  specialGlow: string;
  aiStyles: string[];
  voicePitch: number;
  voiceRate: number;
  // Visual distinction
  bodyScale: number;       // 0.8-1.4 multiplier for body size
  headScale: number;       // 0.8-1.3 multiplier for head size
  armorType: 'none' | 'light' | 'medium' | 'heavy' | 'robe';
  helmetType: 'none' | 'crown' | 'horns' | 'hood' | 'mask' | 'visor' | 'bandana' | 'mohawk' | 'spikes' | 'halo' | 'skull' | 'flame';
  capeColor: string | null;    // null = no cape
  glowColor: string | null;    // null = no aura glow
  scarCount: number;           // 0-3 facial scars
  eyeColor: string;
  eyeGlow: boolean;
  tattooColor: string | null;  // null = no tattoos
  trailColor: string | null;   // null = no movement trail
  // Voice lines
  koWinnerLines: string[];
  koLoserLines: string[];
  specialLines: string[];
  tauntLines: string[];
}

export const CHARACTERS: CharacterDef[] = [
  // ── 1. SIEGFRIED — Holy Knight ──
  {
    id: 'siegfried', name: 'SIEGFRIED', title: 'Holy Knight',
    color: '#8B0000', color2: '#daa520',
    skin: '#e8b878', hair: '#2a1a0a',
    weaponKey: 'greatsword', specialType: 'skullFire',
    specialName: 'SKULL INFERNO', specialColor: '#f80', specialGlow: '#fa0',
    aiStyles: ['berserker', 'guardian', 'juggernaut'],
    voicePitch: 0.75, voiceRate: 0.88,
    bodyScale: 1.1, headScale: 1.0,
    armorType: 'heavy', helmetType: 'crown',
    capeColor: '#600', glowColor: null,
    scarCount: 1, eyeColor: '#4af', eyeGlow: false,
    tattooColor: null, trailColor: null,
    koWinnerLines: ["By the holy blade you are vanquished!", "Your skull makes a fine trophy!", "Kneel before the holy knight!", "Another soul purified by my blade!", "The light has judged you unworthy!", "I've slain dragons tougher than you!"],
    koLoserLines: ["The light fades from my eyes...", "I have failed my sacred oath...", "This cannot be I am SIEGFRIED!", "My armor shattered like glass...", "Tell the kingdom I fought with honor...", "Even holy knights bleed..."],
    specialLines: ["BURN IN HELL!", "TASTE THE SKULL'S FURY!", "FEEL THE SACRED FLAMES!", "YOUR SOUL IS FORFEIT!"],
    tauntLines: ["Your technique is laughable!", "I've trained with gods you mortal!", "Come face divine judgment!", "You dare challenge a holy knight?!"],
  },

  // ── 2. NIGHTMARE — Dark Knight ──
  {
    id: 'nightmare', name: 'NIGHTMARE', title: 'Dark Knight',
    color: '#1a1a4a', color2: '#6a0a6a',
    skin: '#c4956a', hair: '#111',
    weaponKey: 'axe', specialType: 'dragonStrike',
    specialName: 'DRAGON FURY', specialColor: '#0088ff', specialGlow: '#00aaff',
    aiStyles: ['assassin', 'wild', 'tactician'],
    voicePitch: 0.65, voiceRate: 0.82,
    bodyScale: 1.15, headScale: 1.05,
    armorType: 'heavy', helmetType: 'horns',
    capeColor: '#1a0a3a', glowColor: '#4400ff',
    scarCount: 2, eyeColor: '#ff0000', eyeGlow: true,
    tattooColor: '#4400aa', trailColor: '#440088',
    koWinnerLines: ["Darkness consumes all!", "Your nightmare has only begun!", "I am the shadow that devours!", "Pathetic mortal scum!", "The void welcomes your corpse!", "Tremble before true darkness!"],
    koLoserLines: ["The darkness retreats for now...", "Impossible no one defeats NIGHTMARE!", "I will return from the shadows...", "This is not the end of darkness...", "My dark power wanes...", "The void rejects my failure..."],
    specialLines: ["DRAGON DESTROY THEM!", "UNLEASH THE BEAST!", "FLY MY DRAGON!", "FEEL THE DRAGON'S WRATH!"],
    tauntLines: ["You cannot escape the dark!", "I am your worst nightmare!", "Shadows always win!", "Bow before the darkness!"],
  },

  // ── 3. INFERNO — Fire Demon ──
  {
    id: 'inferno', name: 'INFERNO', title: 'Fire Demon',
    color: '#cc3300', color2: '#ff6600',
    skin: '#8b3a2a', hair: '#ff4400',
    weaponKey: 'longsword', specialType: 'meteorRain',
    specialName: 'METEOR STORM', specialColor: '#ff6600', specialGlow: '#ff8800',
    aiStyles: ['berserker', 'wild', 'showboat'],
    voicePitch: 0.7, voiceRate: 0.95,
    bodyScale: 1.05, headScale: 0.95,
    armorType: 'none', helmetType: 'flame',
    capeColor: null, glowColor: '#ff4400',
    scarCount: 0, eyeColor: '#ffff00', eyeGlow: true,
    tattooColor: '#ff6600', trailColor: '#ff4400',
    koWinnerLines: ["Everything burns in the end!", "Your ashes will feed my flames!", "I am the fire that never dies!", "Reduced to cinders!", "The inferno spares no one!", "Burn baby BURN!"],
    koLoserLines: ["My flames extinguished?!", "Even hellfire can be quenched...", "The embers will rise again!", "Impossible I AM fire itself!", "Water my only weakness...", "The furnace grows cold..."],
    specialLines: ["RAIN FIRE FROM THE HEAVENS!", "METEORS OBLITERATE!", "THE SKY IS FALLING ON YOU!", "HEAVEN AND HELL RAIN DOWN!"],
    tauntLines: ["Getting warm yet?!", "I'll melt that smug face off!", "Play with fire get burned!", "Your flesh will sizzle nicely!"],
  },

  // ── 4. FROST — Ice Assassin ──
  {
    id: 'frost', name: 'FROST', title: 'Ice Assassin',
    color: '#1a4a6a', color2: '#88eeff',
    skin: '#d4cee8', hair: '#e0e8ff',
    weaponKey: 'spear', specialType: 'iceBlast',
    specialName: 'FROZEN TOMB', specialColor: '#00ddff', specialGlow: '#88eeff',
    aiStyles: ['assassin', 'tactician', 'acrobat'],
    voicePitch: 1.1, voiceRate: 1.05,
    bodyScale: 0.9, headScale: 0.95,
    armorType: 'light', helmetType: 'mask',
    capeColor: '#2a5a8a', glowColor: '#0088ff',
    scarCount: 0, eyeColor: '#00ffff', eyeGlow: true,
    tattooColor: '#44aaff', trailColor: '#0088ff',
    koWinnerLines: ["Cold as death precise as ice.", "You shattered like frozen glass!", "Winter claims another victim.", "Freeze then break.", "Your blood runs cold... permanently.", "Ice is patient. Ice always wins."],
    koLoserLines: ["The ice... it melts...", "Impossible I don't feel warmth...", "A crack in the glacier...", "The cold cannot protect me...", "Spring comes for everyone...", "My frozen heart shatters..."],
    specialLines: ["FREEZE!", "ABSOLUTE ZERO!", "BECOME AN ICE SCULPTURE!", "WINTER IS HERE!"],
    tauntLines: ["You're already dead just frozen.", "Cold blooded is a compliment.", "Chill out permanently.", "Ice to meet your end."],
  },

  // ── 5. VIPER — Poison Ninja ──
  {
    id: 'viper', name: 'VIPER', title: 'Poison Ninja',
    color: '#2a5a2a', color2: '#44ff44',
    skin: '#b8a878', hair: '#1a3a1a',
    weaponKey: 'longsword', specialType: 'poisonCloud',
    specialName: 'TOXIC MIASMA', specialColor: '#44ff44', specialGlow: '#88ff88',
    aiStyles: ['assassin', 'wild', 'acrobat'],
    voicePitch: 1.0, voiceRate: 1.12,
    bodyScale: 0.85, headScale: 0.9,
    armorType: 'light', helmetType: 'bandana',
    capeColor: null, glowColor: null,
    scarCount: 1, eyeColor: '#00ff00', eyeGlow: false,
    tattooColor: '#00aa00', trailColor: '#008804',
    koWinnerLines: ["The venom works fast!", "You never saw me coming!", "Poison is the art of patience!", "One drop is all it takes!", "Your organs are dissolving!", "Death by a thousand toxins!"],
    koLoserLines: ["My own venom betrays me...", "Even serpents can be crushed...", "The antidote I need the antidote!", "A ninja should never be caught...", "The poison couldn't save me...", "I've been... outvenomed..."],
    specialLines: ["BREATHE DEEP!", "TOXIC CLOUD DEPLOY!", "INHALE YOUR DOOM!", "THE MIASMA CONSUMES!"],
    tauntLines: ["Already poisoned you didn't notice.", "My blade drips with your death.", "Silent and deadly like gas.", "You smell that? It's your end."],
  },

  // ── 6. TITAN — War Juggernaut ──
  {
    id: 'titan', name: 'TITAN', title: 'War Juggernaut',
    color: '#5a4a2a', color2: '#a88040',
    skin: '#6a4a2a', hair: '#000',
    weaponKey: 'axe', specialType: 'earthquake',
    specialName: 'SEISMIC SLAM', specialColor: '#aa8800', specialGlow: '#ffaa00',
    aiStyles: ['juggernaut', 'berserker', 'guardian'],
    voicePitch: 0.6, voiceRate: 0.78,
    bodyScale: 1.4, headScale: 1.1,
    armorType: 'heavy', helmetType: 'spikes',
    capeColor: null, glowColor: null,
    scarCount: 3, eyeColor: '#ffaa00', eyeGlow: false,
    tattooColor: '#884400', trailColor: null,
    koWinnerLines: ["TITAN SMASH!", "You are NOTHING before me!", "I crush mountains you are less!", "The earth itself trembles!", "Puny fighter! PUNY!", "I didn't even feel that!"],
    koLoserLines: ["Even titans can fall...", "The mountain crumbles...", "How?! I am TITAN!", "My strength wasn't enough...", "The bigger they are...", "The earth weeps for me..."],
    specialLines: ["FEEL THE EARTH SHAKE!", "SEISMIC DEVASTATION!", "THE GROUND IS MY WEAPON!", "EARTHQUAKE!"],
    tauntLines: ["I bench press boulders for fun!", "You're an ant to me!", "Titan doesn't block Titan TANKS!", "Try harder little one!"],
  },

  // ── 7. SHADE — Shadow Wraith ──
  {
    id: 'shade', name: 'SHADE', title: 'Shadow Wraith',
    color: '#2a1a3a', color2: '#aa00ff',
    skin: '#9a8a9a', hair: '#1a0a2a',
    weaponKey: 'longsword', specialType: 'shadowClone',
    specialName: 'PHANTOM SLASH', specialColor: '#aa00ff', specialGlow: '#cc44ff',
    aiStyles: ['assassin', 'acrobat', 'tactician'],
    voicePitch: 1.05, voiceRate: 1.08,
    bodyScale: 0.9, headScale: 0.95,
    armorType: 'robe', helmetType: 'hood',
    capeColor: '#1a0a2a', glowColor: '#80f',
    scarCount: 0, eyeColor: '#f0f', eyeGlow: true,
    tattooColor: '#80f', trailColor: '#60a',
    koWinnerLines: ["You fought my shadow and lost.", "I was never really there.", "The darkness takes another.", "Phantom blade claims you.", "You cannot kill what isn't real.", "Which one was the real me?"],
    koLoserLines: ["The shadows dissipate...", "Even phantoms can be pierced...", "I fade into nothing...", "The shadow realm calls me back...", "My form was too unstable...", "Can you kill a shadow twice..."],
    specialLines: ["SHADOW CLONE ATTACK!", "PHANTOM BARRAGE!", "CAN YOU FIND THE REAL ME?!", "SHADOWS MULTIPLY!"],
    tauntLines: ["You're fighting thin air.", "I exist between the shadows.", "Catch me if you can ghost boy.", "Boo."],
  },

  // ── 8. VOLT — Lightning Fighter ──
  {
    id: 'volt', name: 'VOLT', title: 'Lightning Fighter',
    color: '#4a4a1a', color2: '#ff0',
    skin: '#e8d8a8', hair: '#eee060',
    weaponKey: 'spear', specialType: 'lightningStorm',
    specialName: 'THUNDER REIGN', specialColor: '#ff0', specialGlow: '#ffa',
    aiStyles: ['acrobat', 'berserker', 'showboat'],
    voicePitch: 1.15, voiceRate: 1.15,
    bodyScale: 0.95, headScale: 1.0,
    armorType: 'medium', helmetType: 'mohawk',
    capeColor: null, glowColor: '#ff0',
    scarCount: 1, eyeColor: '#ff0', eyeGlow: true,
    tattooColor: '#ff0', trailColor: '#ff0',
    koWinnerLines: ["ELECTRIFYING finish!", "You got SHOCKED!", "Lightning strikes TWICE!", "Fully CHARGED baby!", "That's a million volts of pain!", "You just got thunderstruck!"],
    koLoserLines: ["Power surge failure...", "My circuits are fried...", "The lightning fades...", "Battery depleted...", "I've been grounded...", "Short circuited..."],
    specialLines: ["THUNDER RAIN DOWN!", "LIGHTNING STORM!", "FEEL THE VOLTAGE!", "TEN THOUSAND VOLTS!"],
    tauntLines: ["I'm too fast for you!", "Lightning never loses!", "You're about to get zapped!", "Resistance is futile!"],
  },

  // ── 9. CRIMSON — Blood Berserker ──
  {
    id: 'crimson', name: 'CRIMSON', title: 'Blood Berserker',
    color: '#5a0a0a', color2: '#f00',
    skin: '#c8a888', hair: '#8a1a1a',
    weaponKey: 'greatsword', specialType: 'bloodFrenzy',
    specialName: 'BLOOD FRENZY', specialColor: '#f00', specialGlow: '#f44',
    aiStyles: ['berserker', 'wild', 'showboat'],
    voicePitch: 0.8, voiceRate: 1.0,
    bodyScale: 1.2, headScale: 1.05,
    armorType: 'medium', helmetType: 'skull',
    capeColor: '#400', glowColor: '#f00',
    scarCount: 3, eyeColor: '#f00', eyeGlow: true,
    tattooColor: '#a00', trailColor: '#f00',
    koWinnerLines: ["YOUR BLOOD FEEDS ME!", "MORE! I NEED MORE BLOOD!", "The crimson tide rises!", "Bathed in your essence!", "Blood for the blood god!", "I can taste your fear!"],
    koLoserLines: ["My own blood spills...", "The frenzy consumes me...", "I drown in crimson...", "The bloodlust wasn't enough...", "Even berserkers fall...", "My blood rage fades..."],
    specialLines: ["BLOOD FRENZY ACTIVATED!", "I FEED ON CARNAGE!", "THE BLOOD BOILS!", "CRIMSON RAGE!"],
    tauntLines: ["I can smell your blood!", "Bleeding yet? You will be!", "My sword thirsts!", "Pain is my breakfast!"],
  },

  // ── 10. GOLEM — Stone Giant ──
  {
    id: 'golem', name: 'GOLEM', title: 'Stone Giant',
    color: '#5a5a5a', color2: '#8a8a6a',
    skin: '#8a8a7a', hair: '#4a4a3a',
    weaponKey: 'axe', specialType: 'boulderThrow',
    specialName: 'BOULDER CRUSH', specialColor: '#a96', specialGlow: '#ca8',
    aiStyles: ['juggernaut', 'guardian', 'berserker'],
    voicePitch: 0.55, voiceRate: 0.72,
    bodyScale: 1.35, headScale: 1.2,
    armorType: 'none', helmetType: 'spikes',
    capeColor: null, glowColor: null,
    scarCount: 0, eyeColor: '#fa0', eyeGlow: true,
    tattooColor: null, trailColor: null,
    koWinnerLines: ["GOLEM CRUSH PUNY HUMAN!", "Stone always wins!", "You hit like a pebble!", "Golem is unbreakable!", "Crushed to dust!", "Rock beats everything!"],
    koLoserLines: ["Golem crumble...", "The stones fall apart...", "Golem not understand losing...", "Rock can break?!", "Golem needs glue...", "The mountain erodes..."],
    specialLines: ["GOLEM THROW BIG ROCK!", "BOULDER SMASH!", "CATCH THIS!", "STONE RAIN!"],
    tauntLines: ["Golem bored. Fight harder.", "You tickle Golem.", "Golem stand here all day.", "Puny. Very puny."],
  },

  // ── 11. REAPER — Death Incarnate ──
  {
    id: 'reaper', name: 'REAPER', title: 'Death Incarnate',
    color: '#1a1a1a', color2: '#4f4',
    skin: '#b8b0a8', hair: '#e8e0d8',
    weaponKey: 'spear', specialType: 'soulHarvest',
    specialName: 'SOUL HARVEST', specialColor: '#8f8', specialGlow: '#afa',
    aiStyles: ['tactician', 'assassin', 'guardian'],
    voicePitch: 0.68, voiceRate: 0.85,
    bodyScale: 1.0, headScale: 0.9,
    armorType: 'robe', helmetType: 'hood',
    capeColor: '#111', glowColor: '#4f4',
    scarCount: 0, eyeColor: '#0f0', eyeGlow: true,
    tattooColor: null, trailColor: '#4f4',
    koWinnerLines: ["Your soul is now mine.", "Death comes for all.", "Another name in my ledger.", "The harvest is bountiful.", "You were always going to die here.", "I am inevitable."],
    koLoserLines: ["Death cannot die... can it?", "The scythe falls from my grip...", "Even reapers can be reaped...", "My hourglass empties...", "The afterlife rejects me...", "I cheat death but not today..."],
    specialLines: ["YOUR SOUL IS MINE!", "HARVEST TIME!", "REAP WHAT YOU SOW!", "THE SCYTHE HUNGERS!"],
    tauntLines: ["I've seen your death already.", "Tick tock your time runs out.", "Death is patient.", "Your expiration date is today."],
  },

  // ── 12. PHOENIX — Flame Spirit ──
  {
    id: 'phoenix', name: 'PHOENIX', title: 'Flame Spirit',
    color: '#aa5500', color2: '#fc0',
    skin: '#e8c888', hair: '#ff6600',
    weaponKey: 'longsword', specialType: 'fireTornado',
    specialName: 'FIRE VORTEX', specialColor: '#f80', specialGlow: '#fc0',
    aiStyles: ['showboat', 'acrobat', 'wild'],
    voicePitch: 1.0, voiceRate: 1.05,
    bodyScale: 0.95, headScale: 1.0,
    armorType: 'light', helmetType: 'halo',
    capeColor: '#f60', glowColor: '#f80',
    scarCount: 0, eyeColor: '#ff0', eyeGlow: true,
    tattooColor: '#f80', trailColor: '#f60',
    koWinnerLines: ["From the ashes I rise!", "The phoenix NEVER dies!", "Reborn through your defeat!", "My flames are eternal!", "Ash to ash dust to dust!", "The fire of rebirth consumes you!"],
    koLoserLines: ["I will rise again...", "The flame flickers but never dies...", "From these ashes I shall return...", "A temporary setback...", "Even the phoenix must rest...", "The cycle continues..."],
    specialLines: ["FIRE TORNADO!", "SPIN INTO OBLIVION!", "THE VORTEX CONSUMES!", "BURN IN THE CYCLONE!"],
    tauntLines: ["You can't kill what rises again!", "My flames dance with joy!", "Warm enough for you?!", "I am the eternal flame!"],
  },
];

export const getCharacter = (id: string): CharacterDef =>
  CHARACTERS.find(c => c.id === id) ?? CHARACTERS[0];
