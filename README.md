# 7×7 Dots and Boxes Game 🎮

A modern, responsive, and visually polished **Dots and Boxes** web game built with vanilla HTML5, CSS3, and modern modular ES6 JavaScript.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Board](https://img.shields.io/badge/Board-7%C3%977%20Boxes%20(8%C3%978%20Dots)-brightgreen)
![Tests](https://img.shields.io/badge/Tests-100%25%20Passing%20(59%2F59)-success)

---

## 🎯 Game Features & Rules

- **Board Dimensions**:
  - $8 \times 8$ Dots (64 intersection dots)
  - $7 \times 7$ Boxes (49 total boxes)
  - 112 Selectable Lines (56 horizontal + 56 vertical)
- **⏱️ 20-Second Turn Timer**:
  - Each player has 20 seconds to choose a line.
  - Color-shifting visual progress bar (Green $\rightarrow$ Amber $\rightarrow$ Red warning pulse).
  - If 20s expires without a move, the turn is automatically skipped and given to the opponent.
  - Completing a box resets the timer back to 20s for the extra turn.
- **🌐 Real-Time Online Multiplayer**:
  - Peer-to-peer WebRTC matchmaking via 6-digit room codes (e.g. `BOX-8492`).
  - Play live across separate devices or browser tabs with zero server lag.
- **👤 JSON-Based Login & Player Profiles**:
  - Username customisation and avatar emoji selector (⚡, 🚀, 👑, 👾, etc.).
  - Win/Loss stats and match history stored in JSON format.
- **Extra Turn Mechanic**:
  - Completing 1 box $\rightarrow$ $+1$ point and **1 extra turn**.
  - Completing 2 boxes (with one shared line) $\rightarrow$ $+2$ points and **exactly 1 extra turn**.
  - Completing 0 boxes $\rightarrow$ Turn passes to the other player.
- **Game Modes**:
  - 🌐 **Online Multiplayer (Live Room Code)**
  - 👥 **2-Player Local (Pass & Play)**
  - 🤖 **vs AI (Casual)**
  - 🧠 **vs AI (Smart)**: Avoids giving away 3-sided boxes and seizes chains.

---

## 📁 Project Structure

```
dots-and-boxes/
├── index.html          # Accessible markup with scoreboard, controls, and SVG board
├── css/
│   └── style.css       # Design system, animations, responsive layouts
├── js/
│   ├── constants.js    # Board constants, player theme configurations
│   ├── audio.js        # Web Audio API sound synthesizer
│   ├── gameLogic.js    # Core move, scoring, and box completion engine
│   ├── ai.js           # Single-player AI heuristic algorithms
│   └── app.js          # SVG renderer and UI interaction controller
└── test/
    └── gameLogic.test.js # Automated verification test suite (1,000 match simulation)
```

---

## 🚀 How to Run Locally

### 1. Direct Browser Play
Simply open `index.html` in any modern web browser.

### 2. Run Test Suite
```bash
node test/gameLogic.test.js
```

---

## 📜 License
MIT
