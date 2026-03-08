<p align="center">
  <img src="https://img.shields.io/badge/Engine-HTML5%20Canvas-orange?style=for-the-badge&logo=html5" />
  <img src="https://img.shields.io/badge/Framework-React%2018-61DAFB?style=for-the-badge&logo=react" />
  <img src="https://img.shields.io/badge/Language-TypeScript-3178C6?style=for-the-badge&logo=typescript" />
  <img src="https://img.shields.io/badge/External%20Assets-ZERO-ff0000?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Audio%20Files-ZERO-ff0000?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Sprite%20Sheets-ZERO-ff0000?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Game%20Engine-NONE-ff0000?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Status-Fully%20Playable-brightgreen?style=for-the-badge" />
</p>

<h1 align="center">⚔️ RAGDOLL ARENA: MORTAL CARNAGE ⚔️</h1>

<h3 align="center">A brutal 2D fighting game with ragdoll physics, dismemberment, 12 unique fighters, a 12-boss campaign, full gamepad support, and procedural audio — built from <b>100% pure code</b>.</h3>

<p align="center">
  <em>Every pixel is drawn. Every sound is synthesized. Every animation is math.<br/>No sprites. No audio files. No game engine. No excuses.</em>
</p>

---

## 💀 What Is This?

**Ragdoll Arena** is a physics-based 2D fighting game running entirely in your browser. It features a **12-level campaign** with progressively massive bosses, **12 unique playable characters**, an advanced AI system with 10 personality archetypes, Verlet ragdoll physics, limb dismemberment, brutal fatalities, and full PS4/Xbox controller support.

**The selling point?** The entire game — every character, every animation frame, every particle effect, every sound effect, every background element — is **generated from code at runtime**. There are zero image files, zero audio files, zero sprite sheets, and zero external game libraries in this project. Just ~5,000 lines of TypeScript rendered to a single HTML5 Canvas.

---

## 🔥 Feature Breakdown

### 🗡️ 12 Unique Playable Characters

Every fighter is a fully realized character with distinct visuals, weapons, stats, voice lines, and fighting personality:

| # | Fighter | Class | Weapon | Special Attack | Armor | Helmet |
|---|---------|-------|--------|----------------|-------|--------|
| 1 | **Siegfried** | Holy Knight | Greatsword | Skull Inferno 🔥 | Heavy | Crown |
| 2 | **Nightmare** | Dark Knight | Battle Axe | Dragon Fury 🐉 | Heavy | Horns |
| 3 | **Ivy** | Whip Sorceress | Whip | Soul Drain 💜 | Light | None |
| 4 | **Mitsurugi** | Samurai | Katana | Sakura Storm 🌸 | Medium | Bandana |
| 5 | **Taki** | Shadow Ninja | Dual Daggers | Shadow Clone 🌑 | Light | Mask |
| 6 | **Voldo** | Contortionist | Claws | Blood Carnival 🩸 | None | Visor |
| 7 | **Cervantes** | Ghost Pirate | Cutlass | Cannon Barrage 💣 | Medium | None |
| 8 | **Kilik** | Staff Monk | Staff | Jade Dragon 🐲 | Robe | None |
| 9 | **Maxi** | Brawler King | Nunchaku | Phoenix Rage 🔥 | Light | Mohawk |
| 10 | **Sophitia** | Divine Warrior | Sword & Shield | Olympus Wrath ⚡ | Medium | Halo |
| 11 | **Astaroth** | Demon Golem | War Hammer | Earthquake Slam 💥 | Heavy | Spikes |
| 12 | **Yoshimitsu** | Cyber Ronin | Tech Blade | Digital Overload ⚡ | Light | Visor |

Each character also features:
- 🎨 Unique color palettes, skin tones, and hair colors
- 🛡️ Distinct armor types (none / light / medium / heavy / robe)
- ⚔️ Weapon-specific reach, speed, and damage profiles
- 🔮 Custom special attack with unique particle effects and glow colors
- 🗣️ 6+ KO winner lines, 6+ KO loser lines, 4+ special lines, 4+ taunts
- 👁️ Visual traits: eye glow, scars, tattoos, capes, aura trails
- 🧠 AI personality styles that define how they fight

---

### 🏰 12-Level Campaign: The Gauntlet of Horrors

Fight through 12 increasingly terrifying bosses. Each boss is **physically larger**, **visually scarier**, and **statistically deadlier** than the last:

| Lvl | Boss | Scale | HP | DMG | Location | Visual Traits |
|-----|------|-------|----|-----|----------|---------------|
| 1 | **The Deserter** | 0.95x | 1.0x | 1.0x | Abandoned Outpost | Light armor, nervous |
| 2 | **Iron Fang** | 1.0x | 1.1x | 1.05x | Bandit's Crossing | Bandana, scarred |
| 3 | **The Butcher** | 1.1x | 1.2x | 1.1x | Slaughterhouse | Blood-soaked, heavy |
| 4 | **Warden Kross** | 1.15x | 1.3x | 1.15x | Prison Fortress | Visor, iron armor |
| 5 | **Venom Queen** | 1.2x | 1.3x | 1.15x | Poison Marshlands | Green glow, toxic aura |
| 6 | **Bone Colossus** | 1.3x | 1.5x | 1.2x | Skeleton Cathedral | Skull helmet, bone white |
| 7 | **The Flayed One** | 1.4x | 1.6x | 1.3x | Torture Halls | No skin, exposed muscle |
| 8 | **Inferno Lord** | 1.5x | 1.7x | 1.35x | Volcanic Core | Flame helmet, fire aura |
| 9 | **Abyssal Hydra** | 1.6x | 1.8x | 1.4x | Sunken Abyss | Multiple scars, deep blue |
| 10 | **The Lich Emperor** | 1.7x | 1.9x | 1.5x | Necropolis | Glowing eyes, death aura |
| 11 | **Titan of Ruin** | 1.85x | 2.0x | 1.6x | Shattered Coliseum | Massive, spike helmet |
| 12 | **Thanatos, Death God** | 2.0x | 2.2x | 1.7x | Throne of Oblivion | Skull mask, red eye glow, flame aura |

**Campaign features:**
- 📖 Unique story intro and defeat text for every boss
- 🎬 Cinematic VS screen with player and boss rendered side-by-side
- 💀 Boss aura effects with pulsing radial gradients
- 📈 Progressive difficulty scaling across all stats

---

### 🤖 Advanced AI System

The AI isn't scripted — it **thinks**:

- **10 personality styles**: Berserker, Assassin, Guardian, Kickboxer, Wild, Gunslinger, Acrobat, Tactician, Showboat, Juggernaut
- **Dynamic style shifting** — AI switches fighting philosophy mid-combat based on HP, stamina, and momentum
- **Intent-based decision tree** — AI reads player state (recovery frames, HP threshold, stamina) and chooses from 15+ strategic intents
- **18 pre-built combo sequences** with hit-confirm logic
- **Fatality awareness** — AI recognizes when the opponent is in kill range and attempts finishing moves
- **Adaptive aggression** — AI becomes more reckless when losing, more cautious when ahead
- **Punish detection** — AI identifies recovery windows and counter-attacks

---

### ⚔️ Deep Combat System

**30+ attack types** organized into a complete fighting game moveset:

| Category | Moves |
|----------|-------|
| **Weapon Strikes** | Slash, Heavy Slash, Stab, Overhead, Spin Slash, Dash Stab |
| **Kicks** | Front Kick, Head Kick, Knee Strike, Roundhouse |
| **Aerial** | Jump Attack, Divekick, Backflip Kick, Wall-Flip Attack |
| **Movement** | Wall Run, Dodge (with i-frames), Dash |
| **Defense** | Block (shield HP system), Timed Parry |
| **Special** | Character-specific special attacks with particle FX |
| **Ranged** | Projectile system with bullet physics |
| **Finishers** | Fatality system with multiple execution types |

**Combat mechanics:**
- 💪 Stamina management — attacks cost stamina, creating risk/reward decisions
- 🛡️ Shield HP — blocking degrades your shield over time
- ⚡ Combo counter with damage scaling
- 🎯 Damage numbers floating on impact
- 🕐 Slow-motion triggers on critical hits and finishers

---

### 💀 Ragdoll Physics & Gore

- **Verlet integration** ragdoll simulation with joint constraints on KO
- **Dismemberment** — limbs can be severed during combat
- **Severed limbs as weapons** — pick up and fight with detached body parts
- **Dynamic blood particles** — airborne spray, ground splatter, persistent pools
- **Gore chunks** — meaty debris on heavy impacts
- **Configurable blood intensity** — from clean to absolute carnage

---

### 🎵 100% Procedural Audio

Every single sound in the game is **synthesized at runtime** using the Web Audio API. Zero audio files exist in this project:

| Sound | Synthesis Method |
|-------|-----------------|
| Hits & Kicks | Sawtooth oscillator + noise burst, frequency ramp 120→40Hz |
| Slashes | Highpass-filtered noise buffer with sine envelope |
| Heavy Impacts | Square wave 60→20Hz + noise burst, extended decay |
| Blocks | Triangle wave 800→200Hz, sharp transient |
| Gunshots | Noise burst + oscillator layering |
| KO Sounds | Multi-oscillator chord with long decay |
| Round Start | Rising frequency sweep |
| Footsteps | Short filtered noise bursts |

---

### 🎮 Full Controller Support

Designed for couch play with complete gamepad integration:

- **Analog stick movement** — proportional speed based on stick magnitude
- **D-pad** — digital movement + full menu navigation
- **Configurable deadzone** (default 0.15, adjustable in settings)
- **Menu navigation** — D-pad/Analog to browse, ✕ to confirm, ○ to go back
- **In-game PS4 controller diagram** — SVG-rendered button mapping reference
- **Keyboard layout reference** — side-by-side with controller mapping

---

### ⚙️ Extensive Settings System

Four tabs of tweakable options — because every player is different:

| Tab | Settings |
|-----|----------|
| 🔊 **General** | Master volume, music volume, SFX volume |
| 🎮 **Controls** | Full PS4 controller SVG diagram, keyboard layout, deadzone slider |
| ⚔️ **Gameplay** | Move speed multiplier, blood amount, slow-mo intensity, auto-face enemy, damage numbers toggle, combo counter toggle |
| 🖥️ **Display** | Camera zoom level, screen shake intensity |

---

### 🎬 Cinematic Presentation

- **Character select screen** — live canvas previews of all 12 fighters in a grid
- **Detail panel** — selected character rendered at 1.7x scale with stat bars (Body, Head, Armor), weapon type, and taunt lines
- **VS screen** — player and boss rendered side-by-side with dramatic boss aura
- **Story text** — unique narrative intro and defeat dialogue for every boss encounter
- **Boss aura effects** — pulsing radial gradients that intensify with boss tier

### 🤖 AI vs AI Spectator Mode

Don't want to fight? Watch two AI-controlled fighters battle with full combat intelligence, style switching, and commentary.

---

## 🏗️ Technical Architecture

```
src/
├── components/
│   ├── RagdollArena.tsx      # ~4,200 lines — THE ENTIRE GAME ENGINE
│   │   ├── Vector Math Library
│   │   ├── Web Audio Synthesizer (12 SFX types)
│   │   ├── Weapon Definitions & Physics (10+ weapons)
│   │   ├── Fighter State Machine (30+ states)
│   │   ├── Verlet Ragdoll Physics (17-point skeleton)
│   │   ├── Particle Systems (blood, sparks, dust, projectiles)
│   │   ├── Camera System (smooth follow + parallax)
│   │   ├── AI Decision Engine (10 personalities, 15+ intents)
│   │   ├── Input Handler (Keyboard + Gamepad API)
│   │   ├── Canvas Rendering Pipeline
│   │   ├── Campaign Progression & Story System
│   │   ├── Settings Manager (4 tabs, 10+ tweakables)
│   │   └── Menu System with Controller Navigation
│   │
│   └── CharacterData.ts      # ~540 lines — All 12 characters + 12 bosses
│       ├── Character Definitions (colors, stats, voice lines, visual traits)
│       └── Boss Definitions (scaling, story text, difficulty multipliers)
│
├── pages/
│   └── Index.tsx             # Entry point
└── ...
```

### Zero Dependencies for Game Logic

The game uses **absolutely no external libraries** for:

| System | Implementation |
|--------|---------------|
| **Physics** | Custom Verlet integration with constraint solving |
| **Rendering** | Raw Canvas 2D API (`fillRect`, `arc`, `lineTo`, gradients) |
| **Audio** | Web Audio API oscillators, noise buffers, filters |
| **Input** | Native Gamepad API + KeyboardEvent listeners |
| **Animation** | `requestAnimationFrame` game loop at 60fps |
| **AI** | Custom intent-based decision tree with personality system |
| **Particles** | Object pool with velocity, gravity, and lifetime |
| **Camera** | Smooth lerp tracking with dead zone |

### Key Technical Decisions

- **Single-component architecture** — the entire game runs in one React component to avoid reconciliation overhead during the 60fps game loop
- **`useRef` game state** — all mutable game state lives in refs, not React state, for zero-cost updates
- **Procedural everything** — no build step for assets, no loading screens, instant startup
- **Resolution-independent** — all rendering is proportional, scales to any canvas size

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/your-username/ragdoll-arena.git
cd ragdoll-arena

# Install dependencies
npm install

# Start development server
npm run dev
```

Open `http://localhost:5173` — select **Campaign** or **AI vs AI** and start fighting.

---

## 🎮 Controls

### Keyboard

| Action | Key |
|--------|-----|
| Move Left/Right | `A`/`D` or `←`/`→` |
| Jump | `W` or `↑` |
| Light Attack | `J` |
| Heavy Attack | `K` |
| Kick | `L` |
| Block | `S` or `↓` |
| Dodge | `Shift` |
| Special Attack | `Space` |
| Shoot | `F` |

### PS4 / Xbox Controller

| Action | Button |
|--------|--------|
| Move | Left Stick / D-pad |
| Jump | △ / Y |
| Light Attack | □ / X |
| Heavy Attack | △ / Y |
| Kick | ○ / B |
| Block | L1 / LB |
| Dodge | R1 / RB |
| Special | R2 / RT |
| Shoot | L2 / LT |
| Menu Confirm | ✕ / A |
| Menu Back | ○ / B |

---

## 🧠 Why 100% Code?

> *"The best games don't need assets — they need physics, math, and soul."*

Every visual element is drawn with Canvas primitives. Every sound is a synthesized waveform. This means:

- ⚡ **Zero loading time** — no assets to download or decode
- 📐 **Infinitely scalable** — resolution-independent vector rendering
- 📦 **Tiny bundle** — the entire game is ~5,000 lines of TypeScript
- 🔧 **Fully hackable** — every parameter is a number you can tweak in code
- ⚖️ **No licensing issues** — zero third-party assets of any kind
- 🚀 **Instant startup** — no asset pipeline, no preloading, no waiting

---

## 🧪 Tech Stack

| Technology | Purpose |
|-----------|---------|
| **React 18** | Component lifecycle & UI overlay |
| **TypeScript** | Type safety across ~5,000 lines |
| **Vite** | Sub-second HMR and optimized builds |
| **HTML5 Canvas** | Hardware-accelerated 2D rendering |
| **Web Audio API** | Real-time procedural sound synthesis |
| **Gamepad API** | Native controller support |
| **Tailwind CSS** | HUD overlay styling |
| **shadcn/ui** | Settings panel components |

---

## 📜 License

MIT — Use it, fork it, mod it, ship it.

---

<p align="center">
  <b>Built with nothing but code, math, and violence.</b><br/>
  <em>No sprites were harmed in the making of this game.</em><br/><br/>
  <strong>⚔️ ~5,000 lines of TypeScript. Zero assets. Infinite carnage. ⚔️</strong>
</p>
