<p align="center">
  <img src="https://img.shields.io/badge/Engine-HTML5%20Canvas-orange?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Framework-React%2018-61DAFB?style=for-the-badge&logo=react" />
  <img src="https://img.shields.io/badge/Language-TypeScript-3178C6?style=for-the-badge&logo=typescript" />
  <img src="https://img.shields.io/badge/Physics-Verlet%20Ragdoll-red?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Status-Playable-brightgreen?style=for-the-badge" />
</p>

<h1 align="center">⚔️ MORTAL RAGDOLL: ARENA OF CARNAGE ⚔️</h1>

<p align="center">
  <strong>A brutally satisfying AI-vs-AI ragdoll fighting game with real-time physics, limb dismemberment, weapon combat, and live TTS commentary — all running in your browser.</strong>
</p>

<p align="center">
  <em>No downloads. No installs. Just carnage.</em>
</p>

---

## 🩸 What Is This?

**Mortal Ragdoll** is a 2D side-scrolling fighting game built entirely with the **HTML5 Canvas API** and **React**. Two AI-controlled fighters engage in brutal combat across a sprawling 6000-pixel-wide arena, complete with:

- 🦴 **17-point Verlet ragdoll physics** — every limb moves realistically
- 🗡️ **10+ weapon types** — greatswords, axes, spears, flails, katanas, revolvers, and more
- 💀 **Limb dismemberment** — arms, legs, and heads can be severed mid-fight
- 🩸 **Dynamic gore system** — blood splatter, pools, gore chunks, and impact sparks
- 🎙️ **Live TTS commentary** — a male-voiced announcer calls the fight in real-time
- 🎵 **Procedural SFX** — all sounds generated via Web Audio API (no audio files!)
- 🌙 **Parallax night sky** — multi-layer scrolling with moon, stars, clouds, and mountains

---

## 🎮 Features

### ⚔️ Combat System
| Feature | Description |
|---------|-------------|
| **AI Fighters** | Two fully autonomous fighters with intelligent attack patterns, blocking, dodging, and combo chains |
| **Weapon Variety** | Greatsword, Battle Axe, Spear, Katana, Flail, Longsword, Dual Daggers, Hammer, Revolver, Halberd |
| **Attack Types** | Slashes, thrusts, kicks, headbutts, weapon throws, and gunshots |
| **Combo System** | Chain hits together for devastating multi-hit combos with announcer callouts |
| **Stamina System** | Fighters manage stamina for attacks and blocks — exhaustion creates openings |
| **Blocking & Parrying** | Shield-based defense with directional blocking |

### 🦴 Physics & Gore
| Feature | Description |
|---------|-------------|
| **Verlet Integration** | 17-point skeletal ragdoll with realistic joint constraints |
| **Limb Severing** | Arms, legs, and heads can be cut off — fighters keep fighting! |
| **Limb Weapons** | Severed limbs can be picked up and used as weapons |
| **Blood Physics** | Airborne blood particles, ground splatter, and persistent blood pools |
| **Gore Chunks** | Meaty debris flies on heavy impacts |
| **Impact Effects** | Spark showers, impact rings, lightning bolts, and screen shake |

### 🎙️ Audio & Commentary
| Feature | Description |
|---------|-------------|
| **TTS Commentary** | Browser Speech Synthesis with strictly male voice selection |
| **3 Distinct Voices** | Commentator, Fighter 1, and Fighter 2 each have unique pitch/rate |
| **Dynamic Lines** | Context-aware commentary for combos, low health, dismemberment, KOs |
| **Procedural SFX** | All sound effects synthesized in real-time via Web Audio API oscillators |
| **SFX Types** | Hits, slashes, heavy impacts, blocks, kicks, headbutts, gunshots, severing |

### 🌙 Visual Design
| Feature | Description |
|---------|-------------|
| **Parallax Background** | 5-layer scrolling: stars → moon → clouds → far mountains → near mountains |
| **Dynamic Scenery** | Dead trees, gravestones, ruined pillars, skulls, fences, and castles |
| **Torch Lighting** | Animated flickering torches with glow effects |
| **Castle Windows** | Distant castles with warm flickering window light |
| **Atmospheric Effects** | Vignette overlay, slow-motion on big hits, screen flash on impacts |
| **MK-Style HUD** | Health bars, stamina bars, round timer, combo counter, weapon display |

---

## 🏗️ Technical Architecture

```
src/components/RagdollArena.tsx   ← The entire game engine (~2800 lines)
├── Math Utilities                 ← Vector ops, clamping, RNG
├── Web Audio SFX System           ← Procedural sound synthesis
├── TTS Commentary Engine          ← Male-only voice selection + dynamic lines
├── Ragdoll Physics (Verlet)       ← 17-point skeleton with constraints
├── Fighter State Machine          ← AI decision-making, attacks, blocking
├── Weapon System                  ← 10+ weapons with unique properties
├── Particle Systems               ← Blood, sparks, gore, lightning, rings
├── Severing & Dismemberment       ← Limb removal + physics for detached parts
├── Camera System                  ← Smooth tracking with parallax layers
├── Renderer                       ← Canvas 2D drawing pipeline
└── React HUD Overlay              ← Health, stamina, timer, round info
```

### Key Technical Decisions

- **Zero external game libraries** — pure Canvas 2D + React, no Pixi.js, no Matter.js
- **Zero audio files** — every sound is synthesized at runtime via Web Audio API
- **Verlet integration** over traditional physics — simpler, more stable for ragdolls
- **Single-component architecture** — the entire game runs in one React component for maximum performance (no React reconciliation overhead during gameplay)
- **`useRef` game state** — all mutable game state lives in a ref to avoid re-renders during the 60fps game loop

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- A modern browser with Web Audio API and Speech Synthesis support

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd mortal-ragdoll

# Install dependencies
npm install

# Start the development server
npm run dev
```

Then open `http://localhost:5173` and hit **FIGHT**.

### Build for Production

```bash
npm run build
# Output in dist/
```

---

## 🎮 How to Play

This is an **AI-vs-AI spectator game**. You watch two fighters battle it out automatically.

1. **Click FIGHT** on the title screen
2. **Watch the carnage unfold** — the AI controls both fighters
3. **Listen to the commentary** — the announcer calls out combos, dismemberments, and KOs
4. **Best of 3 rounds** — first to win 2 rounds takes the match
5. **Automatic rematches** — after a match ends, a new fight begins with randomized weapons

### Settings
- **SFX Volume** — adjust sound effect volume
- **TTS Volume** — adjust commentary volume
- **TTS toggle** — enable/disable voice commentary

---

## 🗡️ Weapon Guide

| Weapon | Type | Range | Speed | Special |
|--------|------|-------|-------|---------|
| 🗡️ Greatsword | Slash | Long | Slow | High damage, wide arc |
| 🪓 Battle Axe | Slash | Medium | Medium | Devastating power hits |
| 🔱 Spear | Thrust | Very Long | Fast | Excellent reach |
| ⚔️ Katana | Slash | Medium | Very Fast | Quick combo potential |
| ⛓️ Flail | Slash | Long | Slow | Unpredictable arcs |
| 🗡️ Longsword | Slash | Medium | Medium | Balanced all-rounder |
| 🔪 Dual Daggers | Thrust | Short | Very Fast | Rapid strikes |
| 🔨 Hammer | Slash | Short | Very Slow | Massive impact damage |
| 🔫 Revolver | Ranged | Infinite | Fast | Projectile-based |
| 🪓 Halberd | Slash | Very Long | Slow | Reach + power |

---

## 🧪 Tech Stack

| Technology | Purpose |
|-----------|---------|
| **React 18** | UI framework & component lifecycle |
| **TypeScript** | Type safety across the entire codebase |
| **Vite** | Lightning-fast HMR and build tooling |
| **HTML5 Canvas** | Hardware-accelerated 2D rendering |
| **Web Audio API** | Real-time procedural sound synthesis |
| **Speech Synthesis API** | Live text-to-speech fight commentary |
| **Tailwind CSS** | Styling for HUD overlay elements |
| **shadcn/ui** | UI components for settings panel |

---

## 📁 Project Structure

```
mortal-ragdoll/
├── public/
│   ├── favicon.ico
│   └── robots.txt
├── src/
│   ├── components/
│   │   ├── RagdollArena.tsx      # 🎮 The entire game engine
│   │   ├── NavLink.tsx
│   │   └── ui/                   # shadcn/ui components
│   ├── pages/
│   │   ├── Index.tsx             # Main page (renders the arena)
│   │   └── NotFound.tsx
│   ├── hooks/                    # Custom React hooks
│   ├── lib/                      # Utility functions
│   ├── index.css                 # Global styles + design tokens
│   ├── App.tsx                   # Router setup
│   └── main.tsx                  # Entry point
├── package.json
├── tailwind.config.ts
├── vite.config.ts
└── tsconfig.json
```

---

## 🎯 Roadmap

- [ ] Player-controlled fighter mode (keyboard input)
- [ ] Character selection screen with unique stats
- [ ] Tournament bracket mode
- [ ] Online multiplayer spectating
- [ ] Custom arena environments
- [ ] Replay system with slow-motion highlights
- [ ] Mobile touch controls
- [ ] Leaderboard & fight statistics

---

## 🤝 Contributing

Contributions are welcome! Whether it's new weapons, fighter AI improvements, visual effects, or bug fixes:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📜 License

This project is open source. Feel free to use, modify, and distribute.

---

<p align="center">
  <strong>⚔️ FINISH HIM ⚔️</strong>
  <br/>
  <em>Built with blood, sweat, and approximately 2800 lines of TypeScript.</em>
</p>
