import { BOARD_CONFIG, PLAYERS, PLAYER_CONFIG, GAME_MODES } from './constants.js';
import { DotsAndBoxesGame } from './gameLogic.js';
import { DotsAndBoxesAI } from './ai.js';
import { sound } from './audio.js';

class DotsAndBoxesApp {
  constructor() {
    this.game = new DotsAndBoxesGame();
    this.currentMode = GAME_MODES.PASS_AND_PLAY;
    this.isAiThinking = false;
    this.bannerTimeout = null;

    this.cacheDom();
    this.bindEvents();
    this.initBoardSVG();
    this.updateUI();
  }

  cacheDom() {
    this.boardSvg = document.getElementById('board-svg');
    this.p1ScoreEl = document.getElementById('p1-score');
    this.p2ScoreEl = document.getElementById('p2-score');
    this.p1CardEl = document.getElementById('p1-card');
    this.p2CardEl = document.getElementById('p2-card');
    this.p2NameEl = document.getElementById('p2-name');
    this.turnIndicatorEl = document.getElementById('turn-indicator');
    this.boxesLeftEl = document.getElementById('boxes-left');
    this.boxesCompletedEl = document.getElementById('boxes-completed');
    this.progressFillP1 = document.getElementById('progress-p1');
    this.progressFillP2 = document.getElementById('progress-p2');
    this.bannerEl = document.getElementById('game-banner');
    this.bannerTextEl = document.getElementById('banner-text');

    // Controls
    this.btnNewGame = document.getElementById('btn-new-game');
    this.btnUndo = document.getElementById('btn-undo');
    this.btnMute = document.getElementById('btn-mute');
    this.modeSelector = document.getElementById('mode-selector');

    // Game Over Modal
    this.gameOverModal = document.getElementById('game-over-modal');
    this.modalTitle = document.getElementById('modal-title');
    this.modalSub = document.getElementById('modal-subtitle');
    this.modalP1Score = document.getElementById('modal-p1-score');
    this.modalP2Score = document.getElementById('modal-p2-score');
    this.btnPlayAgain = document.getElementById('btn-play-again');
  }

  bindEvents() {
    this.btnNewGame.addEventListener('click', () => this.handleNewGame());
    this.btnPlayAgain.addEventListener('click', () => {
      this.closeGameOverModal();
      this.handleNewGame();
    });
    this.btnUndo.addEventListener('click', () => this.handleUndo());
    this.btnMute.addEventListener('click', () => this.handleMuteToggle());
    this.modeSelector.addEventListener('change', (e) => this.handleModeChange(e.target.value));
  }

  /**
   * Generates the SVG board grid:
   * 8x8 dots, 7x7 boxes, 56 horizontal lines, 56 vertical lines
   */
  initBoardSVG() {
    const boxSize = 64; // Visual size in SVG viewBox
    const padding = 36;
    const totalWidth = padding * 2 + (BOARD_CONFIG.DOT_COLS - 1) * boxSize;
    const totalHeight = padding * 2 + (BOARD_CONFIG.DOT_ROWS - 1) * boxSize;

    this.boardSvg.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
    this.boardSvg.innerHTML = '';

    const svgNS = 'http://www.w3.org/2000/svg';

    // 1. Boxes Layer (7 rows x 7 cols = 49 boxes)
    const boxesGroup = document.createElementNS(svgNS, 'g');
    boxesGroup.setAttribute('id', 'boxes-layer');

    for (let r = 0; r < BOARD_CONFIG.BOX_ROWS; r++) {
      for (let c = 0; c < BOARD_CONFIG.BOX_COLS; c++) {
        const x = padding + c * boxSize;
        const y = padding + r * boxSize;

        const boxGroup = document.createElementNS(svgNS, 'g');
        boxGroup.setAttribute('class', 'box-item');
        boxGroup.setAttribute('id', `box-${r}-${c}`);

        const rect = document.createElementNS(svgNS, 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', boxSize);
        rect.setAttribute('height', boxSize);
        rect.setAttribute('class', 'box-rect');

        const text = document.createElementNS(svgNS, 'text');
        text.setAttribute('x', x + boxSize / 2);
        text.setAttribute('y', y + boxSize / 2 + 5);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('class', 'box-label');
        text.textContent = '';

        boxGroup.appendChild(rect);
        boxGroup.appendChild(text);
        boxesGroup.appendChild(boxGroup);
      }
    }
    this.boardSvg.appendChild(boxesGroup);

    // 2. Lines Layer (Horizontal & Vertical lines)
    const linesGroup = document.createElementNS(svgNS, 'g');
    linesGroup.setAttribute('id', 'lines-layer');

    // 2A. Horizontal Lines (8 rows x 7 cols = 56 lines)
    for (let r = 0; r < BOARD_CONFIG.DOT_ROWS; r++) {
      for (let c = 0; c < BOARD_CONFIG.BOX_COLS; c++) {
        const x1 = padding + c * boxSize;
        const y = padding + r * boxSize;
        const x2 = x1 + boxSize;

        const lineGroup = document.createElementNS(svgNS, 'g');
        lineGroup.setAttribute('class', 'line-group horizontal-line');
        lineGroup.setAttribute('id', `h-line-${r}-${c}`);
        lineGroup.dataset.type = 'h';
        lineGroup.dataset.row = r;
        lineGroup.dataset.col = c;

        // Visual line
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y);
        line.setAttribute('class', 'grid-line');

        // Extended transparent hit area for easy tapping on touch/mobile
        const hitArea = document.createElementNS(svgNS, 'line');
        hitArea.setAttribute('x1', x1);
        hitArea.setAttribute('y1', y);
        hitArea.setAttribute('x2', x2);
        hitArea.setAttribute('y2', y);
        hitArea.setAttribute('class', 'line-hitarea');

        lineGroup.appendChild(line);
        lineGroup.appendChild(hitArea);

        lineGroup.addEventListener('click', () => this.handleLineClick('h', r, c));
        linesGroup.appendChild(lineGroup);
      }
    }

    // 2B. Vertical Lines (7 rows x 8 cols = 56 lines)
    for (let r = 0; r < BOARD_CONFIG.BOX_ROWS; r++) {
      for (let c = 0; c < BOARD_CONFIG.DOT_COLS; c++) {
        const x = padding + c * boxSize;
        const y1 = padding + r * boxSize;
        const y2 = y1 + boxSize;

        const lineGroup = document.createElementNS(svgNS, 'g');
        lineGroup.setAttribute('class', 'line-group vertical-line');
        lineGroup.setAttribute('id', `v-line-${r}-${c}`);
        lineGroup.dataset.type = 'v';
        lineGroup.dataset.row = r;
        lineGroup.dataset.col = c;

        // Visual line
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', x);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x);
        line.setAttribute('y2', y2);
        line.setAttribute('class', 'grid-line');

        // Extended transparent hit area
        const hitArea = document.createElementNS(svgNS, 'line');
        hitArea.setAttribute('x1', x);
        hitArea.setAttribute('y1', y1);
        hitArea.setAttribute('x2', x);
        hitArea.setAttribute('y2', y2);
        hitArea.setAttribute('class', 'line-hitarea');

        lineGroup.appendChild(line);
        lineGroup.appendChild(hitArea);

        lineGroup.addEventListener('click', () => this.handleLineClick('v', r, c));
        linesGroup.appendChild(lineGroup);
      }
    }
    this.boardSvg.appendChild(linesGroup);

    // 3. Dots Layer (8 rows x 8 cols = 64 dots)
    const dotsGroup = document.createElementNS(svgNS, 'g');
    dotsGroup.setAttribute('id', 'dots-layer');

    for (let r = 0; r < BOARD_CONFIG.DOT_ROWS; r++) {
      for (let c = 0; c < BOARD_CONFIG.DOT_COLS; c++) {
        const cx = padding + c * boxSize;
        const cy = padding + r * boxSize;

        const dot = document.createElementNS(svgNS, 'circle');
        dot.setAttribute('cx', cx);
        dot.setAttribute('cy', cy);
        dot.setAttribute('r', 5.5);
        dot.setAttribute('class', 'grid-dot');
        dotsGroup.appendChild(dot);
      }
    }
    this.boardSvg.appendChild(dotsGroup);
  }

  /**
   * Handles user interaction when selecting a line.
   */
  handleLineClick(type, row, col) {
    if (this.game.isGameOver || this.isAiThinking) return;

    // In AI mode, prevent human from clicking during AI turn (Player 2)
    if (this.currentMode !== GAME_MODES.PASS_AND_PLAY && this.game.currentPlayer === PLAYERS.PLAYER_2) {
      return;
    }

    this.processMove(type, row, col);
  }

  /**
   * Core move handler that updates model, sounds, animations, and transitions.
   */
  processMove(type, row, col) {
    const result = this.game.makeMove(type, row, col);
    if (!result.success) return;

    const player = result.move.player;
    sound.playLineClick();

    // 1. Highlight line in UI
    const lineId = `${type}-line-${row}-${col}`;
    const lineGroup = document.getElementById(lineId);
    if (lineGroup) {
      lineGroup.classList.add('drawn', `player-${player}`);
      lineGroup.classList.add('just-drawn');
      setTimeout(() => lineGroup.classList.remove('just-drawn'), 400);
    }

    // 2. Animate and color newly completed boxes
    if (result.completedBoxes.length > 0) {
      sound.playBoxComplete(result.completedBoxes.length > 1);

      result.completedBoxes.forEach((box, idx) => {
        const boxEl = document.getElementById(`box-${box.row}-${box.col}`);
        if (boxEl) {
          boxEl.classList.add('claimed', `player-${player}`);
          const label = boxEl.querySelector('.box-label');
          if (label) {
            label.textContent = PLAYER_CONFIG[player].avatar;
          }
        }
      });

      // Show extra turn banner
      const extraBoxesText = result.completedBoxes.length === 1 ? '+1 BOX!' : '+2 BOXES!';
      this.showBanner(`${extraBoxesText} EXTRA TURN!`, player);
    }

    // 3. Update scores and scoreboard
    this.updateUI();

    // 4. Check for Game Over
    if (result.isGameOver) {
      sound.playGameOver();
      setTimeout(() => this.showGameOverModal(result.winner), 500);
      return;
    }

    // 5. Trigger AI move if active and it's AI's turn
    if (this.currentMode !== GAME_MODES.PASS_AND_PLAY && this.game.currentPlayer === PLAYERS.PLAYER_2) {
      this.scheduleAiMove();
    }
  }

  /**
   * AI move processing with realistic thinking delay.
   */
  scheduleAiMove() {
    this.isAiThinking = true;
    this.turnIndicatorEl.classList.add('ai-thinking');

    setTimeout(() => {
      if (this.game.isGameOver) {
        this.isAiThinking = false;
        return;
      }

      const aiMove = DotsAndBoxesAI.getMove(this.game, this.currentMode);
      this.isAiThinking = false;
      this.turnIndicatorEl.classList.remove('ai-thinking');

      if (aiMove) {
        this.processMove(aiMove.type, aiMove.row, aiMove.col);
      }
    }, 450);
  }

  /**
   * Displays temporary floating banner notification.
   */
  showBanner(message, player) {
    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);

    this.bannerTextEl.textContent = message;
    this.bannerEl.className = `game-banner show player-${player}`;

    this.bannerTimeout = setTimeout(() => {
      this.bannerEl.classList.remove('show');
    }, 1200);
  }

  /**
   * Synchronizes UI scoreboard, badges, cards, and turn banners with game state.
   */
  updateUI() {
    const p1Score = this.game.scores[PLAYERS.PLAYER_1];
    const p2Score = this.game.scores[PLAYERS.PLAYER_2];
    const completed = this.game.completedBoxes;
    const remaining = BOARD_CONFIG.TOTAL_BOXES - completed;

    this.p1ScoreEl.textContent = p1Score;
    this.p2ScoreEl.textContent = p2Score;
    this.boxesLeftEl.textContent = remaining;
    this.boxesCompletedEl.textContent = completed;

    // Update progress bars
    const p1Pct = (p1Score / BOARD_CONFIG.TOTAL_BOXES) * 100;
    const p2Pct = (p2Score / BOARD_CONFIG.TOTAL_BOXES) * 100;
    this.progressFillP1.style.width = `${p1Pct}%`;
    this.progressFillP2.style.width = `${p2Pct}%`;

    // Active player highlight
    const curr = this.game.currentPlayer;
    if (curr === PLAYERS.PLAYER_1) {
      this.p1CardEl.classList.add('active');
      this.p2CardEl.classList.remove('active');
      this.turnIndicatorEl.innerHTML = `
        <span class="turn-dot player-1-dot"></span>
        <span>${PLAYER_CONFIG[1].name}'s Turn</span>
      `;
      this.turnIndicatorEl.className = 'turn-indicator player-1-active';
    } else {
      this.p2CardEl.classList.add('active');
      this.p1CardEl.classList.remove('active');
      const p2DisplayName = this.currentMode === GAME_MODES.PASS_AND_PLAY ? 'Player 2' : 'AI Opponent';
      this.turnIndicatorEl.innerHTML = `
        <span class="turn-dot player-2-dot"></span>
        <span>${p2DisplayName}'s Turn</span>
      `;
      this.turnIndicatorEl.className = 'turn-indicator player-2-active';
    }

    // Enable/disable undo button
    this.btnUndo.disabled = this.game.moveHistory.length === 0 || this.isAiThinking;
  }

  handleUndo() {
    if (this.game.moveHistory.length === 0 || this.isAiThinking) return;

    this.closeGameOverModal();

    // In AI mode, undo until it is Player 1's turn again
    if (this.currentMode !== GAME_MODES.PASS_AND_PLAY) {
      while (this.game.moveHistory.length > 0) {
        const undone = this.game.undoMove();
        if (undone && undone.player === PLAYERS.PLAYER_1) {
          break;
        }
      }
    } else {
      this.game.undoMove();
    }

    this.initBoardSVG();
    this.redrawAllFromHistory();
    this.updateUI();
  }

  redrawAllFromHistory() {
    const history = [...this.game.moveHistory];
    this.game.reset();

    for (const move of history) {
      const result = this.game.makeMove(move.type, move.row, move.col);
      const lineId = `${move.type}-line-${move.row}-${move.col}`;
      const lineGroup = document.getElementById(lineId);
      if (lineGroup) {
        lineGroup.classList.add('drawn', `player-${move.player}`);
      }

      if (result.completedBoxes.length > 0) {
        result.completedBoxes.forEach((box) => {
          const boxEl = document.getElementById(`box-${box.row}-${box.col}`);
          if (boxEl) {
            boxEl.classList.add('claimed', `player-${move.player}`);
            const label = boxEl.querySelector('.box-label');
            if (label) label.textContent = PLAYER_CONFIG[move.player].avatar;
          }
        });
      }
    }
  }

  handleNewGame() {
    this.closeGameOverModal();
    this.game.reset();
    this.isAiThinking = false;
    this.initBoardSVG();
    this.updateUI();
    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
    this.bannerEl.classList.remove('show');
  }

  handleModeChange(newMode) {
    this.currentMode = newMode;
    if (newMode === GAME_MODES.PASS_AND_PLAY) {
      this.p2NameEl.textContent = 'Player 2';
    } else if (newMode === GAME_MODES.VS_AI_EASY) {
      this.p2NameEl.textContent = 'AI (Easy)';
    } else {
      this.p2NameEl.textContent = 'AI (Smart)';
    }
    this.handleNewGame();
  }

  handleMuteToggle() {
    const muted = sound.toggleMute();
    this.btnMute.innerHTML = muted ? '🔇 Sound: Off' : '🔊 Sound: On';
    this.btnMute.classList.toggle('active-toggle', !muted);
  }

  showGameOverModal(winner) {
    const p1Score = this.game.scores[PLAYERS.PLAYER_1];
    const p2Score = this.game.scores[PLAYERS.PLAYER_2];

    this.modalP1Score.textContent = p1Score;
    this.modalP2Score.textContent = p2Score;

    if (winner === PLAYERS.PLAYER_1) {
      this.modalTitle.textContent = '🎉 PLAYER 1 WINS!';
      this.modalTitle.style.color = PLAYER_CONFIG[1].color;
      this.modalSub.textContent = `Dominant victory with ${p1Score} claimed boxes!`;
    } else if (winner === PLAYERS.PLAYER_2) {
      const p2Name = this.currentMode === GAME_MODES.PASS_AND_PLAY ? 'Player 2' : 'AI Opponent';
      this.modalTitle.textContent = `🏆 ${p2Name.toUpperCase()} WINS!`;
      this.modalTitle.style.color = PLAYER_CONFIG[2].color;
      this.modalSub.textContent = `Magnificent game with ${p2Score} claimed boxes!`;
    } else {
      this.modalTitle.textContent = '🤝 IT\'S A DRAW!';
      this.modalTitle.style.color = '#eab308';
      this.modalSub.textContent = 'Both players claimed equal boxes!';
    }

    this.gameOverModal.classList.add('active');
  }

  closeGameOverModal() {
    this.gameOverModal.classList.remove('active');
  }
}

// Bootstrap when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new DotsAndBoxesApp();
});
