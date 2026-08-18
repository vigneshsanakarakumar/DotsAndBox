import { BOARD_CONFIG, PLAYERS, PLAYER_CONFIG, GAME_MODES } from './constants.js';
import { DotsAndBoxesGame } from './gameLogic.js';
import { DotsAndBoxesAI } from './ai.js';
import { sound } from './audio.js';
import { auth, AVATAR_PRESETS } from './auth.js';
import { TurnTimer } from './timer.js';
import { OnlineMultiplayerEngine } from './online.js';

class DotsAndBoxesApp {
  constructor() {
    this.game = new DotsAndBoxesGame();
    this.currentMode = GAME_MODES.PASS_AND_PLAY;
    this.isAiThinking = false;
    this.bannerTimeout = null;
    this.selectedAvatar = '⚡';
    this.myOnlinePlayerIndex = 1; // 1 for Host (P1), 2 for Joiner (P2)
    this.onlineEngine = null;

    // Initialize 20s Turn Timer
    this.turnTimer = new TurnTimer({
      duration: 20,
      warningThreshold: 5,
      onTick: (secondsLeft, percent) => this.handleTimerTick(secondsLeft, percent),
      onWarning: (secondsLeft) => this.handleTimerWarning(secondsLeft),
      onTimeout: () => this.handleTurnTimeout()
    });

    this.cacheDom();
    this.initAuthUI();
    this.bindEvents();
    this.initBoardSVG();
    this.updateUI();

    // Start timer on initial game load
    this.turnTimer.start();
  }

  cacheDom() {
    // Header & Profile
    this.userProfileBtn = document.getElementById('user-profile-btn');
    this.btnOpenProfile = document.getElementById('btn-open-profile');
    this.userAvatarBadge = document.getElementById('user-avatar-badge');
    this.userNameDisplay = document.getElementById('user-name-display');
    this.userStatsBadge = document.getElementById('user-stats-badge');

    // Timer elements
    this.turnTimerCard = document.getElementById('turn-timer-card');
    this.timerNumberEl = document.getElementById('timer-number');
    this.timerProgressBar = document.getElementById('timer-progress-bar');

    // Board & Scoreboard
    this.boardSvg = document.getElementById('board-svg');
    this.p1ScoreEl = document.getElementById('p1-score');
    this.p2ScoreEl = document.getElementById('p2-score');
    this.p1CardEl = document.getElementById('p1-card');
    this.p2CardEl = document.getElementById('p2-card');
    this.p1NameEl = document.getElementById('p1-name');
    this.p2NameEl = document.getElementById('p2-name');
    this.p1AvatarEl = document.getElementById('p1-avatar-el');
    this.p2AvatarEl = document.getElementById('p2-avatar-el');
    this.turnIndicatorEl = document.getElementById('turn-indicator');
    this.turnTextEl = document.getElementById('turn-text');
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

    // Login Modal
    this.loginModal = document.getElementById('login-modal');
    this.loginForm = document.getElementById('login-form');
    this.inputUsername = document.getElementById('input-username');
    this.avatarPicker = document.getElementById('avatar-picker');
    this.profileWins = document.getElementById('profile-wins');
    this.profileLosses = document.getElementById('profile-losses');
    this.profileGames = document.getElementById('profile-games');
    this.btnCloseLogin = document.getElementById('btn-close-login');

    // Online Modal
    this.onlineModal = document.getElementById('online-modal');
    this.btnHostRoom = document.getElementById('btn-host-room');
    this.btnJoinRoom = document.getElementById('btn-join-room');
    this.inputJoinCode = document.getElementById('input-join-code');
    this.hostCodeDisplay = document.getElementById('host-code-display');
    this.roomCodeText = document.getElementById('room-code-text');
    this.btnCopyCode = document.getElementById('btn-copy-code');
    this.joinStatusMsg = document.getElementById('join-status-msg');
    this.btnCloseOnline = document.getElementById('btn-close-online');

    // Game Over Modal
    this.gameOverModal = document.getElementById('game-over-modal');
    this.modalTitle = document.getElementById('modal-title');
    this.modalSub = document.getElementById('modal-subtitle');
    this.modalP1Score = document.getElementById('modal-p1-score');
    this.modalP2Score = document.getElementById('modal-p2-score');
    this.modalP1Label = document.getElementById('modal-p1-label');
    this.modalP2Label = document.getElementById('modal-p2-label');
    this.btnPlayAgain = document.getElementById('btn-play-again');
  }

  initAuthUI() {
    let user = auth.getCurrentUser();
    if (!user) {
      user = auth.login('Player 1', '⚡');
    }

    this.selectedAvatar = user.avatar;
    this.refreshUserDisplay(user);

    // Build avatar choices
    this.avatarPicker.innerHTML = '';
    AVATAR_PRESETS.forEach((emoji) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `avatar-choice ${emoji === this.selectedAvatar ? 'selected' : ''}`;
      btn.textContent = emoji;
      btn.addEventListener('click', () => {
        this.selectedAvatar = emoji;
        this.avatarPicker.querySelectorAll('.avatar-choice').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
      this.avatarPicker.appendChild(btn);
    });
  }

  refreshUserDisplay(user) {
    if (!user) return;
    this.userNameDisplay.textContent = user.username;
    this.userAvatarBadge.textContent = user.avatar;
    this.userStatsBadge.textContent = `${user.wins}W - ${user.losses}L`;

    this.inputUsername.value = user.username;
    this.profileWins.textContent = user.wins;
    this.profileLosses.textContent = user.losses;
    this.profileGames.textContent = user.gamesPlayed;

    // If local player is P1 in pass & play or host
    if (this.currentMode !== GAME_MODES.ONLINE_MULTIPLAYER || this.myOnlinePlayerIndex === 1) {
      this.p1NameEl.textContent = user.username;
      this.p1AvatarEl.textContent = user.avatar;
    }
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

    // Profile & Login
    this.userProfileBtn.addEventListener('click', () => this.openLoginModal());
    this.btnOpenProfile.addEventListener('click', () => this.openLoginModal());
    this.btnCloseLogin.addEventListener('click', () => this.closeLoginModal());
    this.loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const updated = auth.login(this.inputUsername.value, this.selectedAvatar);
      this.refreshUserDisplay(updated);
      this.closeLoginModal();
      this.updateUI();
    });

    // Online Lobby
    this.btnHostRoom.addEventListener('click', () => this.handleHostOnlineRoom());
    this.btnJoinRoom.addEventListener('click', () => this.handleJoinOnlineRoom());
    this.btnCopyCode.addEventListener('click', () => this.copyRoomCode());
    this.btnCloseOnline.addEventListener('click', () => this.closeOnlineModal());
  }

  // ------------------------------------------------------------------------
  // Turn Timer Handlers (20s with Timeout Turn Skipping)
  // ------------------------------------------------------------------------

  handleTimerTick(secondsLeft, percent) {
    this.timerNumberEl.textContent = `${secondsLeft}s`;
    this.timerProgressBar.style.width = `${percent}%`;

    // Color shifting: Green -> Amber -> Red
    if (secondsLeft <= 5) {
      this.turnTimerCard.className = 'turn-timer-card warning-pulse';
    } else if (secondsLeft <= 10) {
      this.turnTimerCard.className = 'turn-timer-card warning';
    } else {
      this.turnTimerCard.className = 'turn-timer-card normal';
    }
  }

  handleTimerWarning(secondsLeft) {
    sound.playTimerTick();
  }

  handleTurnTimeout() {
    if (this.game.isGameOver) return;

    sound.playTimeout();
    const result = this.game.handleTimeout();
    if (!result.success) return;

    const skippedPlayer = result.skippedPlayer;
    this.showBanner(`⏰ TIME'S UP! P${skippedPlayer} TURN SKIPPED`, skippedPlayer);

    // If online, broadcast timeout to peer
    if (this.currentMode === GAME_MODES.ONLINE_MULTIPLAYER && this.onlineEngine) {
      if (skippedPlayer === this.myOnlinePlayerIndex) {
        this.onlineEngine.sendTimeout();
      }
    }

    this.updateUI();
    this.turnTimer.start(); // Restart 20s for new player

    // If AI's turn after timeout
    if (this.currentMode !== GAME_MODES.PASS_AND_PLAY && 
        this.currentMode !== GAME_MODES.ONLINE_MULTIPLAYER && 
        this.game.currentPlayer === PLAYERS.PLAYER_2) {
      this.scheduleAiMove();
    }
  }

  // ------------------------------------------------------------------------
  // Board SVG Rendering (8x8 Dots, 7x7 Boxes, 112 Selectable Lines)
  // ------------------------------------------------------------------------

  initBoardSVG() {
    const boxSize = 64;
    const padding = 36;
    const totalWidth = padding * 2 + (BOARD_CONFIG.DOT_COLS - 1) * boxSize;
    const totalHeight = padding * 2 + (BOARD_CONFIG.DOT_ROWS - 1) * boxSize;

    this.boardSvg.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
    this.boardSvg.innerHTML = '';

    const svgNS = 'http://www.w3.org/2000/svg';

    // 1. Boxes Layer (49 boxes)
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

    // 2. Lines Layer (56 H + 56 V lines = 112 lines)
    const linesGroup = document.createElementNS(svgNS, 'g');
    linesGroup.setAttribute('id', 'lines-layer');

    // Horizontal Lines (8 rows x 7 cols)
    for (let r = 0; r < BOARD_CONFIG.DOT_ROWS; r++) {
      for (let c = 0; c < BOARD_CONFIG.BOX_COLS; c++) {
        const x1 = padding + c * boxSize;
        const y = padding + r * boxSize;
        const x2 = x1 + boxSize;

        const lineGroup = document.createElementNS(svgNS, 'g');
        lineGroup.setAttribute('class', 'line-group horizontal-line');
        lineGroup.setAttribute('id', `h-line-${r}-${c}`);

        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y);
        line.setAttribute('class', 'grid-line');

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

    // Vertical Lines (7 rows x 8 cols)
    for (let r = 0; r < BOARD_CONFIG.BOX_ROWS; r++) {
      for (let c = 0; c < BOARD_CONFIG.DOT_COLS; c++) {
        const x = padding + c * boxSize;
        const y1 = padding + r * boxSize;
        const y2 = y1 + boxSize;

        const lineGroup = document.createElementNS(svgNS, 'g');
        lineGroup.setAttribute('class', 'line-group vertical-line');
        lineGroup.setAttribute('id', `v-line-${r}-${c}`);

        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', x);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x);
        line.setAttribute('y2', y2);
        line.setAttribute('class', 'grid-line');

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

  // ------------------------------------------------------------------------
  // Move Processing & Validation
  // ------------------------------------------------------------------------

  handleLineClick(type, row, col) {
    if (this.game.isGameOver || this.isAiThinking) return;

    // Mode lock guards:
    if (this.currentMode === GAME_MODES.ONLINE_MULTIPLAYER) {
      if (this.game.currentPlayer !== this.myOnlinePlayerIndex) return;
    } else if (this.currentMode !== GAME_MODES.PASS_AND_PLAY) {
      if (this.game.currentPlayer === PLAYERS.PLAYER_2) return;
    }

    const moveRes = this.processMove(type, row, col);

    // If online match, broadcast move to opponent
    if (moveRes && moveRes.success && this.currentMode === GAME_MODES.ONLINE_MULTIPLAYER && this.onlineEngine) {
      this.onlineEngine.sendMove(type, row, col);
    }
  }

  processMove(type, row, col) {
    const result = this.game.makeMove(type, row, col);
    if (!result.success) return result;

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

      result.completedBoxes.forEach((box) => {
        const boxEl = document.getElementById(`box-${box.row}-${box.col}`);
        if (boxEl) {
          boxEl.classList.add('claimed', `player-${player}`);
          const label = boxEl.querySelector('.box-label');
          if (label) {
            const avatar = player === 1 ? this.p1AvatarEl.textContent : this.p2AvatarEl.textContent;
            label.textContent = avatar || PLAYER_CONFIG[player].avatar;
          }
        }
      });

      const extraBoxesText = result.completedBoxes.length === 1 ? '+1 BOX!' : '+2 BOXES!';
      this.showBanner(`${extraBoxesText} EXTRA TURN!`, player);
    }

    // 3. Reset 20-second turn timer for next move (or extra turn)
    if (!result.isGameOver) {
      this.turnTimer.start();
    } else {
      this.turnTimer.stop();
    }

    // 4. Update UI & Scores
    this.updateUI();

    // 5. Check Game Over
    if (result.isGameOver) {
      sound.playGameOver();
      this.handleGameOver(result.winner);
      return result;
    }

    // 6. AI Turn handling
    if (this.currentMode !== GAME_MODES.PASS_AND_PLAY && 
        this.currentMode !== GAME_MODES.ONLINE_MULTIPLAYER && 
        this.game.currentPlayer === PLAYERS.PLAYER_2) {
      this.scheduleAiMove();
    }

    return result;
  }

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
    }, 500);
  }

  handleGameOver(winner) {
    const user = auth.getCurrentUser();
    if (user) {
      if (winner === 'DRAW') {
        auth.recordMatch('draw');
      } else if (winner === this.myOnlinePlayerIndex) {
        auth.recordMatch('win');
      } else {
        auth.recordMatch('loss');
      }
      this.refreshUserDisplay(auth.getCurrentUser());
    }

    setTimeout(() => this.showGameOverModal(winner), 500);
  }

  // ------------------------------------------------------------------------
  // Online Multiplayer WebRTC Integration
  // ------------------------------------------------------------------------

  initOnlineEngine() {
    if (!this.onlineEngine) {
      this.onlineEngine = new OnlineMultiplayerEngine({
        onStatusChange: (status, msg) => {
          if (this.joinStatusMsg) this.joinStatusMsg.textContent = msg;
        },
        onRoomReady: (code) => {
          this.hostCodeDisplay.style.display = 'block';
          this.roomCodeText.textContent = code;
        },
        onOpponentJoined: (info) => {
          this.myOnlinePlayerIndex = info.playerIndex;
          this.closeOnlineModal();
          this.showBanner('🎮 OPPONENT CONNECTED! GAME STARTED', 1);
          this.handleNewGame();
        },
        onMoveReceived: (move) => {
          this.processMove(move.type, move.row, move.col);
        },
        onTimeoutReceived: () => {
          this.handleTurnTimeout();
        },
        onDisconnected: () => {
          this.showBanner('⚠️ Opponent disconnected', 2);
        }
      });
    }
  }

  async handleHostOnlineRoom() {
    this.initOnlineEngine();
    const user = auth.getCurrentUser();
    await this.onlineEngine.createRoom(user);
  }

  async handleJoinOnlineRoom() {
    const code = this.inputJoinCode.value.trim();
    if (!code) {
      this.joinStatusMsg.textContent = 'Please enter a valid room code';
      return;
    }
    this.initOnlineEngine();
    const user = auth.getCurrentUser();
    await this.onlineEngine.joinRoom(code, user);
  }

  copyRoomCode() {
    const code = this.roomCodeText.textContent;
    navigator.clipboard.writeText(code).then(() => {
      this.btnCopyCode.textContent = '✅ Copied!';
      setTimeout(() => (this.btnCopyCode.textContent = '📋 Copy'), 2000);
    });
  }

  // ------------------------------------------------------------------------
  // UI Helpers & Synchronization
  // ------------------------------------------------------------------------

  showBanner(message, player) {
    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
    this.bannerTextEl.textContent = message;
    this.bannerEl.className = `game-banner show player-${player}`;
    this.bannerTimeout = setTimeout(() => {
      this.bannerEl.classList.remove('show');
    }, 1300);
  }

  updateUI() {
    const p1Score = this.game.scores[PLAYERS.PLAYER_1];
    const p2Score = this.game.scores[PLAYERS.PLAYER_2];
    const completed = this.game.completedBoxes;
    const remaining = BOARD_CONFIG.TOTAL_BOXES - completed;

    this.p1ScoreEl.textContent = p1Score;
    this.p2ScoreEl.textContent = p2Score;
    this.boxesLeftEl.textContent = remaining;
    this.boxesCompletedEl.textContent = completed;

    // Progress bar
    const p1Pct = (p1Score / BOARD_CONFIG.TOTAL_BOXES) * 100;
    const p2Pct = (p2Score / BOARD_CONFIG.TOTAL_BOXES) * 100;
    this.progressFillP1.style.width = `${p1Pct}%`;
    this.progressFillP2.style.width = `${p2Pct}%`;

    // Active player highlight
    const curr = this.game.currentPlayer;
    const p1Name = this.p1NameEl.textContent;
    const p2Name = this.p2NameEl.textContent;

    if (curr === PLAYERS.PLAYER_1) {
      this.p1CardEl.classList.add('active');
      this.p2CardEl.classList.remove('active');
      this.turnIndicatorEl.className = 'turn-indicator player-1-active';
      this.turnTextEl.textContent = `${p1Name}'s Turn`;
    } else {
      this.p2CardEl.classList.add('active');
      this.p1CardEl.classList.remove('active');
      this.turnIndicatorEl.className = 'turn-indicator player-2-active';
      this.turnTextEl.textContent = `${p2Name}'s Turn`;
    }

    this.btnUndo.disabled = this.game.moveHistory.length === 0 || 
                           this.isAiThinking || 
                           this.currentMode === GAME_MODES.ONLINE_MULTIPLAYER;
  }

  handleUndo() {
    if (this.game.moveHistory.length === 0 || this.isAiThinking) return;

    this.closeGameOverModal();

    if (this.currentMode !== GAME_MODES.PASS_AND_PLAY && this.currentMode !== GAME_MODES.ONLINE_MULTIPLAYER) {
      while (this.game.moveHistory.length > 0) {
        const undone = this.game.undoMove();
        if (undone && undone.player === PLAYERS.PLAYER_1) break;
      }
    } else {
      this.game.undoMove();
    }

    this.initBoardSVG();
    this.redrawAllFromHistory();
    this.updateUI();
    this.turnTimer.start();
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
            if (label) {
              const avatar = move.player === 1 ? this.p1AvatarEl.textContent : this.p2AvatarEl.textContent;
              label.textContent = avatar || PLAYER_CONFIG[move.player].avatar;
            }
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
    this.turnTimer.start();
    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
    this.bannerEl.classList.remove('show');
  }

  handleModeChange(newMode) {
    this.currentMode = newMode;
    if (newMode === GAME_MODES.ONLINE_MULTIPLAYER) {
      this.openOnlineModal();
    } else if (newMode === GAME_MODES.PASS_AND_PLAY) {
      this.p2NameEl.textContent = 'Player 2';
      this.p2AvatarEl.textContent = 'P2';
      this.handleNewGame();
    } else if (newMode === GAME_MODES.VS_AI_EASY) {
      this.p2NameEl.textContent = 'AI (Casual)';
      this.p2AvatarEl.textContent = '🤖';
      this.handleNewGame();
    } else {
      this.p2NameEl.textContent = 'AI (Smart)';
      this.p2AvatarEl.textContent = '🧠';
      this.handleNewGame();
    }
  }

  handleMuteToggle() {
    const muted = sound.toggleMute();
    this.btnMute.innerHTML = muted ? '🔇' : '🔊';
  }

  openLoginModal() {
    this.turnTimer.pause();
    this.loginModal.classList.add('active');
  }

  closeLoginModal() {
    this.loginModal.classList.remove('active');
    this.turnTimer.resume();
  }

  openOnlineModal() {
    this.turnTimer.pause();
    this.onlineModal.classList.add('active');
  }

  closeOnlineModal() {
    this.onlineModal.classList.remove('active');
    this.turnTimer.resume();
  }

  showGameOverModal(winner) {
    const p1Score = this.game.scores[PLAYERS.PLAYER_1];
    const p2Score = this.game.scores[PLAYERS.PLAYER_2];

    this.modalP1Score.textContent = p1Score;
    this.modalP2Score.textContent = p2Score;
    this.modalP1Label.textContent = this.p1NameEl.textContent;
    this.modalP2Label.textContent = this.p2NameEl.textContent;

    if (winner === PLAYERS.PLAYER_1) {
      this.modalTitle.textContent = `🎉 ${this.p1NameEl.textContent.toUpperCase()} WINS!`;
      this.modalTitle.style.color = PLAYER_CONFIG[1].color;
      this.modalSub.textContent = `Claimed ${p1Score} out of 49 boxes!`;
    } else if (winner === PLAYERS.PLAYER_2) {
      this.modalTitle.textContent = `🏆 ${this.p2NameEl.textContent.toUpperCase()} WINS!`;
      this.modalTitle.style.color = PLAYER_CONFIG[2].color;
      this.modalSub.textContent = `Claimed ${p2Score} out of 49 boxes!`;
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

// Bootstrap on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  window.app = new DotsAndBoxesApp();
});
