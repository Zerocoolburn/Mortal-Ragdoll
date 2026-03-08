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
    specialName: 'SKULL INFERNO', specialColor: '#ff8800', specialGlow: '#ffaa00',
    aiStyles: ['berserker', 'guardian', 'juggernaut'],
    voicePitch: 0.75, voiceRate: 0.88,
    bodyScale: 1.1, headScale: 1.0,
    armorType: 'heavy', helmetType: 'crown',
    capeColor: '#660000', glowColor: null,
    scarCount: 1, eyeColor: '#44aaff', eyeGlow: false,
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
    skin: '#c4956a', hair: '#111111',
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
    skin: '#6a4a2a', hair: '#000000',
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
    capeColor: '#1a0a2a', glowColor: '#8800ff',
    scarCount: 0, eyeColor: '#ff00ff', eyeGlow: true,
    tattooColor: '#8800ff', trailColor: '#6600aa',
    koWinnerLines: ["You fought my shadow and lost.", "I was never really there.", "The darkness takes another.", "Phantom blade claims you.", "You cannot kill what isn't real.", "Which one was the real me?"],
    koLoserLines: ["The shadows dissipate...", "Even phantoms can be pierced...", "I fade into nothing...", "The shadow realm calls me back...", "My form was too unstable...", "Can you kill a shadow twice..."],
    specialLines: ["SHADOW CLONE ATTACK!", "PHANTOM BARRAGE!", "CAN YOU FIND THE REAL ME?!", "SHADOWS MULTIPLY!"],
    tauntLines: ["You're fighting thin air.", "I exist between the shadows.", "Catch me if you can ghost boy.", "Boo."],
  },

  // ── 8. VOLT — Lightning Fighter ──
  {
    id: 'volt', name: 'VOLT', title: 'Lightning Fighter',
    color: '#4a4a1a', color2: '#ffff00',
    skin: '#e8d8a8', hair: '#eee060',
    weaponKey: 'spear', specialType: 'lightningStorm',
    specialName: 'THUNDER REIGN', specialColor: '#ffff00', specialGlow: '#ffffaa',
    aiStyles: ['acrobat', 'berserker', 'showboat'],
    voicePitch: 1.15, voiceRate: 1.15,
    bodyScale: 0.95, headScale: 1.0,
    armorType: 'medium', helmetType: 'mohawk',
    capeColor: null, glowColor: '#ffff00',
    scarCount: 1, eyeColor: '#ffff00', eyeGlow: true,
    tattooColor: '#ffff00', trailColor: '#ffff00',
    koWinnerLines: ["ELECTRIFYING finish!", "You got SHOCKED!", "Lightning strikes TWICE!", "Fully CHARGED baby!", "That's a million volts of pain!", "You just got thunderstruck!"],
    koLoserLines: ["Power surge failure...", "My circuits are fried...", "The lightning fades...", "Battery depleted...", "I've been grounded...", "Short circuited..."],
    specialLines: ["THUNDER RAIN DOWN!", "LIGHTNING STORM!", "FEEL THE VOLTAGE!", "TEN THOUSAND VOLTS!"],
    tauntLines: ["I'm too fast for you!", "Lightning never loses!", "You're about to get zapped!", "Resistance is futile!"],
  },

  // ── 9. CRIMSON — Blood Berserker ──
  {
    id: 'crimson', name: 'CRIMSON', title: 'Blood Berserker',
    color: '#5a0a0a', color2: '#ff0000',
    skin: '#c8a888', hair: '#8a1a1a',
    weaponKey: 'greatsword', specialType: 'bloodFrenzy',
    specialName: 'BLOOD FRENZY', specialColor: '#ff0000', specialGlow: '#ff4444',
    aiStyles: ['berserker', 'wild', 'showboat'],
    voicePitch: 0.8, voiceRate: 1.0,
    bodyScale: 1.2, headScale: 1.05,
    armorType: 'medium', helmetType: 'skull',
    capeColor: '#440000', glowColor: '#ff0000',
    scarCount: 3, eyeColor: '#ff0000', eyeGlow: true,
    tattooColor: '#aa0000', trailColor: '#ff0000',
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
    specialName: 'BOULDER CRUSH', specialColor: '#aa9966', specialGlow: '#ccaa88',
    aiStyles: ['juggernaut', 'guardian', 'berserker'],
    voicePitch: 0.55, voiceRate: 0.72,
    bodyScale: 1.35, headScale: 1.2,
    armorType: 'none', helmetType: 'spikes',
    capeColor: null, glowColor: null,
    scarCount: 0, eyeColor: '#ffaa00', eyeGlow: true,
    tattooColor: null, trailColor: null,
    koWinnerLines: ["GOLEM CRUSH PUNY HUMAN!", "Stone always wins!", "You hit like a pebble!", "Golem is unbreakable!", "Crushed to dust!", "Rock beats everything!"],
    koLoserLines: ["Golem crumble...", "The stones fall apart...", "Golem not understand losing...", "Rock can break?!", "Golem needs glue...", "The mountain erodes..."],
    specialLines: ["GOLEM THROW BIG ROCK!", "BOULDER SMASH!", "CATCH THIS!", "STONE RAIN!"],
    tauntLines: ["Golem bored. Fight harder.", "You tickle Golem.", "Golem stand here all day.", "Puny. Very puny."],
  },

  // ── 11. REAPER — Death Incarnate ──
  {
    id: 'reaper', name: 'REAPER', title: 'Death Incarnate',
    color: '#1a1a1a', color2: '#44ff44',
    skin: '#b8b0a8', hair: '#e8e0d8',
    weaponKey: 'spear', specialType: 'soulHarvest',
    specialName: 'SOUL HARVEST', specialColor: '#88ff88', specialGlow: '#aaffaa',
    aiStyles: ['tactician', 'assassin', 'guardian'],
    voicePitch: 0.68, voiceRate: 0.85,
    bodyScale: 1.0, headScale: 0.9,
    armorType: 'robe', helmetType: 'hood',
    capeColor: '#111111', glowColor: '#44ff44',
    scarCount: 0, eyeColor: '#00ff00', eyeGlow: true,
    tattooColor: null, trailColor: '#44ff44',
    koWinnerLines: ["Your soul is now mine.", "Death comes for all.", "Another name in my ledger.", "The harvest is bountiful.", "You were always going to die here.", "I am inevitable."],
    koLoserLines: ["Death cannot die... can it?", "The scythe falls from my grip...", "Even reapers can be reaped...", "My hourglass empties...", "The afterlife rejects me...", "I cheat death but not today..."],
    specialLines: ["YOUR SOUL IS MINE!", "HARVEST TIME!", "REAP WHAT YOU SOW!", "THE SCYTHE HUNGERS!"],
    tauntLines: ["I've seen your death already.", "Tick tock your time runs out.", "Death is patient.", "Your expiration date is today."],
  },

  // ── 12. PHOENIX — Flame Spirit ──
  {
    id: 'phoenix', name: 'PHOENIX', title: 'Flame Spirit',
    color: '#aa5500', color2: '#ffcc00',
    skin: '#e8c888', hair: '#ff6600',
    weaponKey: 'longsword', specialType: 'fireTornado',
    specialName: 'FIRE VORTEX', specialColor: '#ff8800', specialGlow: '#ffcc00',
    aiStyles: ['showboat', 'acrobat', 'wild'],
    voicePitch: 1.0, voiceRate: 1.05,
    bodyScale: 0.95, headScale: 1.0,
    armorType: 'light', helmetType: 'halo',
    capeColor: '#ff6600', glowColor: '#ff8800',
    scarCount: 0, eyeColor: '#ffff00', eyeGlow: true,
    tattooColor: '#ff8800', trailColor: '#ff6600',
    koWinnerLines: ["From the ashes I rise!", "The phoenix NEVER dies!", "Reborn through your defeat!", "My flames are eternal!", "Ash to ash dust to dust!", "The fire of rebirth consumes you!"],
    koLoserLines: ["I will rise again...", "The flame flickers but never dies...", "From these ashes I shall return...", "A temporary setback...", "Even the phoenix must rest...", "The cycle continues..."],
    specialLines: ["FIRE TORNADO!", "SPIN INTO OBLIVION!", "THE VORTEX CONSUMES!", "BURN IN THE CYCLONE!"],
    tauntLines: ["You can't kill what rises again!", "My flames dance with joy!", "Warm enough for you?!", "I am the eternal flame!"],
  },
];

export const getCharacter = (id: string): CharacterDef =>
  CHARACTERS.find(c => c.id === id) ?? BOSSES.find(c => c.id === id) ?? CHARACTERS[0];

// ═══════════════════════════════════════════════════════
// BOSSES — 12 Unique Campaign Bosses (progressively harder & bigger)
// ═══════════════════════════════════════════════════════

export interface BossDef extends CharacterDef {
  level: number;
  hpMultiplier: number;
  dmgMultiplier: number;
  speedMultiplier: number;
  storyIntro: string;
  storyDefeat: string;
  arenaName: string;
}

export const BOSSES: BossDef[] = [
  // ── LEVEL 1: THE DESERTER (small, pathetic) ──
  {
    level: 1, hpMultiplier: 0.8, dmgMultiplier: 0.7, speedMultiplier: 0.9,
    id: 'boss_deserter', name: 'DESERTER', title: 'Fallen Soldier',
    color: '#4a4a3a', color2: '#6a6a5a', skin: '#c8b898', hair: '#3a2a1a',
    weaponKey: 'longsword', specialType: 'skullFire',
    specialName: 'COWARD\'S FLAME', specialColor: '#ff8800', specialGlow: '#ffaa44',
    aiStyles: ['guardian', 'tactician'], voicePitch: 0.9, voiceRate: 0.95,
    bodyScale: 0.95, headScale: 0.95,
    armorType: 'light', helmetType: 'bandana',
    capeColor: null, glowColor: null, scarCount: 0,
    eyeColor: '#886644', eyeGlow: false, tattooColor: null, trailColor: null,
    storyIntro: 'A deserter from the king\'s army blocks your path. His eyes are hollow, but his blade is sharp.',
    storyDefeat: 'The deserter falls to his knees. "You\'re stronger than I thought... the arena will test you far worse."',
    arenaName: 'ABANDONED OUTPOST',
    koWinnerLines: ["I had no choice!", "Another body for the pile!", "Don't judge me!"],
    koLoserLines: ["I should have stayed...", "The army was right to fear you..."],
    specialLines: ["BURN WITH MY SHAME!", "FIRE CLEANSES ALL!"],
    tauntLines: ["I've seen real war!", "You're just a gladiator!"],
  },
  // ── LEVEL 2: THE BUTCHER (stocky, brutal) ──
  {
    level: 2, hpMultiplier: 1.0, dmgMultiplier: 0.85, speedMultiplier: 0.85,
    id: 'boss_butcher', name: 'BUTCHER', title: 'The Meat Cleaver',
    color: '#5a2a1a', color2: '#aa4422', skin: '#b88868', hair: '#1a0a0a',
    weaponKey: 'axe', specialType: 'bloodFrenzy',
    specialName: 'MEAT GRINDER', specialColor: '#ff2200', specialGlow: '#ff4444',
    aiStyles: ['berserker', 'wild'], voicePitch: 0.7, voiceRate: 0.85,
    bodyScale: 1.1, headScale: 1.05,
    armorType: 'none', helmetType: 'none',
    capeColor: null, glowColor: '#aa0000', scarCount: 2,
    eyeColor: '#ff4400', eyeGlow: true, tattooColor: '#880000', trailColor: '#aa0000',
    storyIntro: 'The Butcher emerges from the slaughterhouse, his apron soaked crimson. He grins with yellowed teeth.',
    storyDefeat: '"Heh... you cut deeper than my cleaver. The pit boss won\'t be happy I lost."',
    arenaName: 'THE SLAUGHTERHOUSE',
    koWinnerLines: ["FRESH MEAT!", "Time to tenderize!", "You're going on the hook!"],
    koLoserLines: ["My cleaver... failed me...", "The meat fought back..."],
    specialLines: ["MEAT GRINDER ACTIVATED!", "CHOP CHOP CHOP!"],
    tauntLines: ["I'll make sausage from you!", "Prime cut, coming up!"],
  },
  // ── LEVEL 3: THE WITCH (eerie, medium) ──
  {
    level: 3, hpMultiplier: 1.0, dmgMultiplier: 1.0, speedMultiplier: 1.1,
    id: 'boss_witch', name: 'HEXIA', title: 'The Cursed Witch',
    color: '#2a1a4a', color2: '#8844cc', skin: '#b8a8c8', hair: '#440088',
    weaponKey: 'spear', specialType: 'poisonCloud',
    specialName: 'HEX CLOUD', specialColor: '#aa44ff', specialGlow: '#cc88ff',
    aiStyles: ['tactician', 'assassin'], voicePitch: 1.2, voiceRate: 1.05,
    bodyScale: 1.0, headScale: 1.0,
    armorType: 'robe', helmetType: 'hood',
    capeColor: '#1a0a3a', glowColor: '#8800ff', scarCount: 0,
    eyeColor: '#ff00ff', eyeGlow: true, tattooColor: '#8800aa', trailColor: '#6600aa',
    storyIntro: 'Purple mist rolls across the swamp. Hexia floats above the murk, her eyes burning with arcane fury.',
    storyDefeat: '"The stars... lied to me. You were not meant to survive this encounter. Go then, but the next will destroy you."',
    arenaName: 'WITCH\'S SWAMP',
    koWinnerLines: ["The hex is complete!", "Your soul belongs to me!", "Cursed forever!"],
    koLoserLines: ["My magic... fading...", "The spirits abandon me..."],
    specialLines: ["BREATHE THE CURSE!", "HEX CLOUD ENGULF!"],
    tauntLines: ["I've seen your death!", "The cards show your doom!"],
  },
  // ── LEVEL 4: THE GLADIATOR (tall, muscular) ──
  {
    level: 4, hpMultiplier: 1.2, dmgMultiplier: 1.0, speedMultiplier: 1.0,
    id: 'boss_gladiator', name: 'MAXIMUS', title: 'Arena Champion',
    color: '#8a6a2a', color2: '#ddaa44', skin: '#c8a878', hair: '#2a1a0a',
    weaponKey: 'greatsword', specialType: 'earthquake',
    specialName: 'COLOSSEUM QUAKE', specialColor: '#ddaa44', specialGlow: '#ffcc66',
    aiStyles: ['berserker', 'guardian', 'showboat'], voicePitch: 0.78, voiceRate: 0.92,
    bodyScale: 1.2, headScale: 1.05,
    armorType: 'heavy', helmetType: 'visor',
    capeColor: '#6a4a1a', glowColor: null, scarCount: 3,
    eyeColor: '#886622', eyeGlow: false, tattooColor: null, trailColor: null,
    storyIntro: 'The crowd roars as Maximus enters. Undefeated in 300 battles, the Arena Champion salutes with his greatsword.',
    storyDefeat: '"300 victories... and you end my streak. The crowd will remember YOUR name now. Earn it."',
    arenaName: 'THE COLOSSEUM',
    koWinnerLines: ["Are you not entertained?!", "The champion prevails!", "300 and counting!"],
    koLoserLines: ["The crowd goes silent...", "My legacy... crumbles..."],
    specialLines: ["FEEL THE COLOSSEUM SHAKE!", "THE ARENA ITSELF FIGHTS FOR ME!"],
    tauntLines: ["I am the greatest!", "The crowd loves ME!"],
  },
  // ── LEVEL 5: THE LIVING SHADOW (unsettling, stretchy) ──
  {
    level: 5, hpMultiplier: 1.1, dmgMultiplier: 1.1, speedMultiplier: 1.2,
    id: 'boss_shadow', name: 'UMBRA', title: 'The Living Shadow',
    color: '#0a0a1a', color2: '#2244aa', skin: '#2a1a3a', hair: '#000011',
    weaponKey: 'longsword', specialType: 'shadowClone',
    specialName: 'SHADOW SPLIT', specialColor: '#2244ff', specialGlow: '#4466ff',
    aiStyles: ['assassin', 'acrobat', 'wild'], voicePitch: 1.0, voiceRate: 1.15,
    bodyScale: 1.25, headScale: 0.85,
    armorType: 'none', helmetType: 'mask',
    capeColor: '#0a0a2a', glowColor: '#0022aa', scarCount: 0,
    eyeColor: '#0044ff', eyeGlow: true, tattooColor: '#001188', trailColor: '#0022aa',
    storyIntro: 'The chamber goes dark. When light returns, Umbra stands before you — a towering being of living shadow, its limbs unnaturally long.',
    storyDefeat: '"You can destroy my form, but shadow is eternal. Deeper in the arena, things get... much worse."',
    arenaName: 'THE SHADOW CHAMBER',
    koWinnerLines: ["Shadows consume!", "You cannot fight darkness!", "I am everywhere!"],
    koLoserLines: ["The shadow... disperses...", "Light wins... this time..."],
    specialLines: ["SHADOW SPLIT!", "WHICH ONE IS REAL?!"],
    tauntLines: ["Strike the shadow!", "I'm behind you!"],
  },
  // ── LEVEL 6: THE BERSERKER KING (huge, savage) ──
  {
    level: 6, hpMultiplier: 1.4, dmgMultiplier: 1.2, speedMultiplier: 0.9,
    id: 'boss_berserker', name: 'GRENDEL', title: 'Berserker King',
    color: '#5a3a1a', color2: '#cc6600', skin: '#6a4a2a', hair: '#4a2a0a',
    weaponKey: 'axe', specialType: 'bloodFrenzy',
    specialName: 'BERSERKER RAGE', specialColor: '#ff6600', specialGlow: '#ff8844',
    aiStyles: ['berserker', 'juggernaut', 'wild'], voicePitch: 0.5, voiceRate: 0.75,
    bodyScale: 1.45, headScale: 1.2,
    armorType: 'none', helmetType: 'horns',
    capeColor: null, glowColor: '#ff4400', scarCount: 3,
    eyeColor: '#ff6600', eyeGlow: true, tattooColor: '#884400', trailColor: '#ff4400',
    storyIntro: 'The mountain trembles. Grendel, the Berserker King, descends from his throne of skulls. He towers over you, his axes as tall as a man.',
    storyDefeat: '"IMPOSSIBLE! No one... bests Grendel! Take my crown then... you will need it for what lies ahead."',
    arenaName: 'SKULL THRONE HALL',
    koWinnerLines: ["GRENDEL SMASH!", "NOTHING STOPS ME!", "I FEAST ON WARRIORS!"],
    koLoserLines: ["The berserker... falls...", "My rage... not enough..."],
    specialLines: ["BERSERKER RAGE!", "UNLIMITED FURY!", "RAAAAAAAGH!"],
    tauntLines: ["I eat warriors for breakfast!", "You are NOTHING!"],
  },
  // ── LEVEL 7: THE FROST EMPRESS (imposing, regal) ──
  {
    level: 7, hpMultiplier: 1.3, dmgMultiplier: 1.2, speedMultiplier: 1.1,
    id: 'boss_empress', name: 'GLACIRA', title: 'Frost Empress',
    color: '#1a3a5a', color2: '#88ccff', skin: '#c4c8ee', hair: '#aaccff',
    weaponKey: 'spear', specialType: 'iceBlast',
    specialName: 'ETERNAL WINTER', specialColor: '#44ccff', specialGlow: '#88eeff',
    aiStyles: ['tactician', 'guardian', 'assassin'], voicePitch: 1.1, voiceRate: 0.95,
    bodyScale: 1.3, headScale: 1.05,
    armorType: 'heavy', helmetType: 'crown',
    capeColor: '#2a4a6a', glowColor: '#4488ff', scarCount: 0,
    eyeColor: '#88eeff', eyeGlow: true, tattooColor: '#4488cc', trailColor: '#2266aa',
    storyIntro: 'The throne room is a frozen wasteland. Glacira rises from her ice throne — she stands head and shoulders above you, frost crystallizing the very air.',
    storyDefeat: '"You melt the ice... but winter always returns. The next opponent knows no mercy, no cold, only FIRE."',
    arenaName: 'THE FROZEN THRONE',
    koWinnerLines: ["Winter is eternal!", "Frozen in time!", "The ice claims another!"],
    koLoserLines: ["The ice... cracks...", "Spring comes after all..."],
    specialLines: ["ETERNAL WINTER!", "FREEZE THE WORLD!"],
    tauntLines: ["Cold-blooded indeed.", "You'll shatter like glass!"],
  },
  // ── LEVEL 8: THE INFERNAL LORD (massive demon) ──
  {
    level: 8, hpMultiplier: 1.5, dmgMultiplier: 1.3, speedMultiplier: 1.0,
    id: 'boss_infernal', name: 'MOLOCH', title: 'Infernal Lord',
    color: '#6a1a00', color2: '#ff4400', skin: '#3a0a00', hair: '#ff2200',
    weaponKey: 'greatsword', specialType: 'meteorRain',
    specialName: 'HELLSTORM', specialColor: '#ff4400', specialGlow: '#ff8800',
    aiStyles: ['berserker', 'wild', 'juggernaut'], voicePitch: 0.45, voiceRate: 0.72,
    bodyScale: 1.55, headScale: 1.15,
    armorType: 'heavy', helmetType: 'flame',
    capeColor: '#440000', glowColor: '#ff2200', scarCount: 3,
    eyeColor: '#ffff00', eyeGlow: true, tattooColor: '#ff4400', trailColor: '#ff2200',
    storyIntro: 'Lava erupts from the floor. Moloch steps through the flames — a towering demon lord, his burning horns scraping the ceiling. The heat is unbearable.',
    storyDefeat: '"You... quench my fire?! No mortal has done this in a thousand years. The undead king awaits you next."',
    arenaName: 'THE INFERNO PIT',
    koWinnerLines: ["BURN IN HELL!", "HELLFIRE CONSUMES!", "I AM THE INFERNO!"],
    koLoserLines: ["The fire... dies...", "Even hell can be extinguished..."],
    specialLines: ["HELLSTORM!", "RAIN OF FIRE!", "METEOR SHOWER!"],
    tauntLines: ["I am born of fire!", "Burn, mortal, BURN!"],
  },
  // ── LEVEL 9: THE UNDEAD KING (large, terrifying) ──
  {
    level: 9, hpMultiplier: 1.6, dmgMultiplier: 1.35, speedMultiplier: 1.05,
    id: 'boss_undead', name: 'REVENANT', title: 'The Undead King',
    color: '#1a2a1a', color2: '#44ff44', skin: '#4a5a4a', hair: '#1a2a1a',
    weaponKey: 'spear', specialType: 'soulHarvest',
    specialName: 'DEATH\'S HARVEST', specialColor: '#44ff44', specialGlow: '#88ff88',
    aiStyles: ['tactician', 'assassin', 'guardian'], voicePitch: 0.5, voiceRate: 0.78,
    bodyScale: 1.5, headScale: 1.1,
    armorType: 'heavy', helmetType: 'skull',
    capeColor: '#0a1a0a', glowColor: '#22aa22', scarCount: 3,
    eyeColor: '#44ff44', eyeGlow: true, tattooColor: '#00aa00', trailColor: '#22aa22',
    storyIntro: 'The crypt opens with a deafening crack. Revenant rises — a hulking armored corpse king, green fire pouring from his hollow eye sockets. His scythe drags across stone.',
    storyDefeat: '"Death is not the end... it is merely a door. You have opened it. What comes through... is your problem."',
    arenaName: 'THE ROYAL CRYPT',
    koWinnerLines: ["Death always wins!", "Your soul is MINE!", "I have died before!"],
    koLoserLines: ["Death... again...", "The grave calls me back..."],
    specialLines: ["HARVEST THEIR SOULS!", "THE DEAD RISE!"],
    tauntLines: ["I've been dead longer than you've been alive!", "Join my army!"],
  },
  // ── LEVEL 10: THE STORM TITAN (enormous colossus) ──
  {
    level: 10, hpMultiplier: 1.8, dmgMultiplier: 1.45, speedMultiplier: 0.95,
    id: 'boss_titan', name: 'THORAXIS', title: 'Storm Titan',
    color: '#3a3a5a', color2: '#ffff00', skin: '#6a6a8a', hair: '#ccccff',
    weaponKey: 'axe', specialType: 'lightningStorm',
    specialName: 'DIVINE STORM', specialColor: '#ffff00', specialGlow: '#ffffaa',
    aiStyles: ['juggernaut', 'berserker', 'wild'], voicePitch: 0.4, voiceRate: 0.68,
    bodyScale: 1.7, headScale: 1.25,
    armorType: 'heavy', helmetType: 'spikes',
    capeColor: '#2a2a4a', glowColor: '#ffff00', scarCount: 3,
    eyeColor: '#ffff00', eyeGlow: true, tattooColor: '#aaaa00', trailColor: '#ffff00',
    storyIntro: 'Thunder splits the sky. Thoraxis descends — a colossus of living stone and crackling lightning, three times your height. The ground shatters beneath each step.',
    storyDefeat: '"You... struck down a TITAN?! The heavens themselves bow to you. But the Void Dragon does not bow."',
    arenaName: 'THE STORM PEAK',
    koWinnerLines: ["THUNDER REIGNS!", "MORTALS KNEEL!", "THE STORM IS ETERNAL!"],
    koLoserLines: ["The thunder... fades...", "Even titans fall..."],
    specialLines: ["DIVINE STORM!", "TEN THOUSAND VOLTS!", "LIGHTNING FROM THE HEAVENS!"],
    tauntLines: ["I am a GOD!", "You challenge the STORM?!"],
  },
  // ── LEVEL 11: THE VOID DRAGON (monstrous, alien) ──
  {
    level: 11, hpMultiplier: 1.9, dmgMultiplier: 1.55, speedMultiplier: 1.15,
    id: 'boss_dragon', name: 'VOIDMAW', title: 'The Void Dragon',
    color: '#0a0a2a', color2: '#4400ff', skin: '#1a0a3a', hair: '#0000aa',
    weaponKey: 'greatsword', specialType: 'dragonStrike',
    specialName: 'VOID ANNIHILATION', specialColor: '#4400ff', specialGlow: '#8844ff',
    aiStyles: ['wild', 'berserker', 'acrobat'], voicePitch: 0.35, voiceRate: 0.65,
    bodyScale: 1.85, headScale: 1.3,
    armorType: 'none', helmetType: 'horns',
    capeColor: '#0a0a2a', glowColor: '#4400ff', scarCount: 0,
    eyeColor: '#8844ff', eyeGlow: true, tattooColor: '#4400aa', trailColor: '#2200aa',
    storyIntro: 'Reality tears open. Voidmaw pours through the rift — a monstrous, barely humanoid abomination that fills the arena. Its many eyes burn with void energy.',
    storyDefeat: '"You... break the void? Impressive. But the GOD OF DEATH himself awaits at the arena\'s heart."',
    arenaName: 'THE VOID RIFT',
    koWinnerLines: ["THE VOID CONSUMES!", "REALITY BENDS!", "YOU ARE NOTHING!"],
    koLoserLines: ["The void... seals...", "Impossible... a mortal..."],
    specialLines: ["VOID ANNIHILATION!", "REALITY SHATTERS!"],
    tauntLines: ["You fight a GOD!", "The void is infinite!"],
  },
  // ── LEVEL 12: DEATH GOD (colossal, ultimate terror) ──
  {
    level: 12, hpMultiplier: 2.2, dmgMultiplier: 1.7, speedMultiplier: 1.2,
    id: 'boss_deathgod', name: 'THANATOS', title: 'God of Death',
    color: '#0a0a0a', color2: '#ff0000', skin: '#1a1a1a', hair: '#110000',
    weaponKey: 'greatsword', specialType: 'soulHarvest',
    specialName: 'ABSOLUTE DEATH', specialColor: '#ff0000', specialGlow: '#ff4444',
    aiStyles: ['berserker', 'tactician', 'wild', 'juggernaut'], voicePitch: 0.3, voiceRate: 0.6,
    bodyScale: 2.0, headScale: 1.4,
    armorType: 'heavy', helmetType: 'skull',
    capeColor: '#0a0000', glowColor: '#ff0000', scarCount: 3,
    eyeColor: '#ff0000', eyeGlow: true, tattooColor: '#aa0000', trailColor: '#ff0000',
    storyIntro: 'The arena falls silent. The sky turns black. THANATOS manifests — a COLOSSAL god of pure death energy, dwarfing everything. His skull face grins from high above. "No mortal has ever stood where you stand. None have survived."',
    storyDefeat: '"I... am... DEATH. And you... you have KILLED death itself. The arena crumbles. You are free. You are... IMMORTAL."',
    arenaName: 'THE THRONE OF OBLIVION',
    koWinnerLines: ["I AM DEATH!", "ALL THINGS END!", "ABSOLUTE ANNIHILATION!"],
    koLoserLines: ["IMPOSSIBLE!", "Death... cannot die...", "What... ARE you?!"],
    specialLines: ["ABSOLUTE DEATH!", "ALL SOULS ARE MINE!", "THE END OF ALL THINGS!"],
    tauntLines: ["I am inevitable.", "Death bows to no one.", "Your fate was sealed at birth."],
  },
];

export const getBoss = (level: number): BossDef => BOSSES.find(b => b.level === level) ?? BOSSES[0];
