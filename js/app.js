import { BOARD_CONFIG, PLAYERS, PLAYER_CONFIG, GAME_MODES, NETWORK_ACTIONS } from './constants.js';
import { DotsAndBoxesGame } from './gameLogic.js';
import { DotsAndBoxesAI } from './ai.js';
import { sound } from './audio.js';
import { auth, AVATAR_PRESETS } from './auth.js';
import { TurnTimer } from './timer.js';
import { OnlineMultiplayerEngine } from './online.js';

/* ============================================================
   APP STATE
   ============================================================ */
const state = {
  /* Auth & Mode */
  mode: null,           // 'offline' | 'online' | 'ai_easy' | 'ai_smart'
  p1User: null,         // profile object for player 1 (logged-in user)
  p2User: null,         // profile object for player 2 (offline only)
  myOnlineIndex: 1,     // 1 = host (P1), 2 = joiner (P2)
  opponentOnlineProfile: null,

  /* Game */
  game: new DotsAndBoxesGame(),
  isAiThinking: false,
  bannerTimeout: null,
};

/* Active avatar selections during registration */
let regAvatar     = '⚡';
let offlineP2Avatar = '🦊';

/* ============================================================
   DOM REFERENCES
   ============================================================ */
const $ = (id) => document.getElementById(id);

// Screens
const homeScreen = $('home-screen');
const gameScreen = $('game-screen');

// Home panels
const profileCard     = $('profile-setup-card');
const modeCard        = $('mode-select-card');
const offlineP2Card   = $('offline-player2-card');
const onlineLobbyCard = $('online-lobby-card');
const leaderboardCard = $('leaderboard-card');

// Auth
const tabRegister  = $('tab-register');
const tabLogin     = $('tab-login');
const panelReg     = $('panel-register');
const panelLogin   = $('panel-login');
const regUsernameInput = $('reg-username');
const regUsernameHint  = $('reg-username-hint');
const regAvatarPicker  = $('reg-avatar-picker');
const btnRegister   = $('btn-register');
const loginUsernameInput = $('login-username');
const loginHint     = $('login-hint');
const btnLogin      = $('btn-login');

// Profile Chip
const activeProfileChip = $('active-profile-chip');
const chipAvatar = $('chip-avatar');
const chipName   = $('chip-name');
const chipStats  = $('chip-stats');
const btnChangeUser = $('btn-change-user');

// Offline p2
const offlineP2Input = $('offline-p2-username');
const offlineP2Hint  = $('offline-p2-hint');
const offlineP2AvatarPicker = $('offline-p2-avatar-picker');
const btnOfflineBack  = $('btn-offline-back');
const btnOfflineStart = $('btn-offline-start');

// Online lobby
const btnCreateRoom   = $('btn-create-room');
const btnJoinRoom     = $('btn-join-room');
const inputJoinCode   = $('input-join-code');
const roomCodeDisplay = $('room-code-display');
const roomCodeValue   = $('room-code-value');
const btnCopyRoomCode = $('btn-copy-room-code');
const roomStatusText  = $('room-status-text');
const joinStatusMsg   = $('join-status-msg');
const btnOnlineBack   = $('btn-online-back');

// Leaderboard
const leaderboardList = $('leaderboard-list');

// Game Screen
const btnExitGame  = $('btn-exit-game');
const btnMute      = $('btn-mute');
const btnUndo      = $('btn-undo');
const btnNewGame   = $('btn-new-game');

const timerCard      = $('turn-timer-card');
const timerNumber    = $('timer-number');
const timerBar       = $('timer-progress-bar');

const p1CardEl  = $('p1-card');
const p2CardEl  = $('p2-card');
const p1NameEl  = $('p1-name-el');
const p2NameEl  = $('p2-name-el');
const p1AvatarEl = $('p1-avatar-el');
const p2AvatarEl = $('p2-avatar-el');
const p1ScoreEl  = $('p1-score');
const p2ScoreEl  = $('p2-score');

const turnIndicatorEl = $('turn-indicator');
const turnTextEl      = $('turn-text');
const boxesCompletedEl = $('boxes-completed');
const boxesLeftEl      = $('boxes-left');
const progressP1 = $('progress-p1');
const progressP2 = $('progress-p2');
const boardSvg   = $('board-svg');
const bannerEl   = $('game-banner');
const bannerTextEl = $('banner-text');

// Modals
const gameOverModal    = $('game-over-modal');
const exitConfirmModal = $('exit-confirm-modal');

const winnerTrophy     = $('winner-trophy');
const modalWinnerTitle = $('modal-winner-title');
const modalSubtitle    = $('modal-subtitle');
const modalP1Label     = $('modal-p1-label');
const modalP2Label     = $('modal-p2-label');
const modalP1Avatar    = $('modal-p1-avatar');
const modalP2Avatar    = $('modal-p2-avatar');
const modalP1Score     = $('modal-p1-score');
const modalP2Score     = $('modal-p2-score');
const btnPlayAgain     = $('btn-play-again');
const btnGoHome        = $('btn-go-home');
const btnConfirmExit   = $('btn-confirm-exit');
const btnCancelExit    = $('btn-cancel-exit');

/* ============================================================
   TURN TIMER
   ============================================================ */
const turnTimer = new TurnTimer({
  duration: 20,
  warningThreshold: 5,
  onTick: (s, pct) => {
    timerNumber.textContent = `${s}s`;
    timerBar.style.width = `${pct}%`;
    if (s <= 5) timerCard.className = 'turn-timer-card danger';
    else if (s <= 10) timerCard.className = 'turn-timer-card warning';
    else timerCard.className = 'turn-timer-card normal';
  },
  onWarning: () => sound.playTimerTick(),
  onTimeout: handleTurnTimeout,
});

/* ============================================================
   ONLINE ENGINE
   ============================================================ */
let onlineEngine = null;

function initOnlineEngine() {
  if (onlineEngine) { onlineEngine.disconnect(); onlineEngine = null; }

  onlineEngine = new OnlineMultiplayerEngine({
    onStatusChange: (status, msg) => {
      roomStatusText.textContent = msg;
      joinStatusMsg.textContent = msg;
    },
    onRoomReady: (code) => {
      roomCodeValue.textContent = code;
      roomCodeDisplay.classList.remove('hidden');
    },
    onOpponentJoined: (info) => {
      state.myOnlineIndex = info.playerIndex;
      // Close lobby, start game
      showOnlineLobby(false);
      startOnlineGame();
    },
    onOpponentProfileReceived: (profile) => {
      state.opponentOnlineProfile = profile;
      // Update whichever slot is the opponent
      const oppIndex = state.myOnlineIndex === 1 ? 2 : 1;
      if (oppIndex === 1) {
        p1NameEl.textContent = profile.username || 'Opponent';
        p1AvatarEl.textContent = profile.avatar || '👾';
      } else {
        p2NameEl.textContent = profile.username || 'Opponent';
        p2AvatarEl.textContent = profile.avatar || '👾';
      }
      updateGameUI();
    },
    onMoveReceived: (move) => {
      // Opponent's move arrives — apply it
      processMove(move.type, move.row, move.col, false);
    },
    onTimeoutReceived: () => {
      handleTurnTimeout(true /* remote event, don't re-broadcast */);
    },
    onDisconnected: () => {
      // Opponent disconnected → current player wins
      if (!state.game.isGameOver) {
        turnTimer.stop();
        const myIndex = state.myOnlineIndex;
        showDisconnectWin(myIndex);
      }
    }
  });
}

/* ============================================================
   NAVIGATION HELPERS
   ============================================================ */
function showScreen(name) {
  homeScreen.classList.toggle('active', name === 'home');
  gameScreen.classList.toggle('active', name === 'game');
}

function showHomePanel(name) {
  profileCard.classList.toggle('hidden', name !== 'profile');
  modeCard.classList.toggle('hidden', name !== 'mode');
  offlineP2Card.classList.toggle('hidden', name !== 'offline-p2');
  onlineLobbyCard.classList.toggle('hidden', name !== 'online-lobby');
}

function showOnlineLobby(visible) {
  onlineLobbyCard.classList.toggle('hidden', !visible);
  modeCard.classList.toggle('hidden', visible);
}

/* ============================================================
   BUILD AVATAR PICKERS
   ============================================================ */
function buildAvatarPicker(container, defaultAvatar, onSelect) {
  container.innerHTML = '';
  AVATAR_PRESETS.forEach((emoji) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `av-btn${emoji === defaultAvatar ? ' selected' : ''}`;
    btn.textContent = emoji;
    btn.addEventListener('click', () => {
      container.querySelectorAll('.av-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      onSelect(emoji);
    });
    container.appendChild(btn);
  });
}

/* ============================================================
   HOME AUTH LOGIC
   ============================================================ */
function initHomeScreen() {
  buildAvatarPicker(regAvatarPicker, regAvatar, (av) => { regAvatar = av; });
  buildAvatarPicker(offlineP2AvatarPicker, offlineP2Avatar, (av) => { offlineP2Avatar = av; });

  // If user already logged in, skip to mode select
  const existingUser = auth.getCurrentUser();
  if (existingUser) {
    state.p1User = existingUser;
    showHomePanel('mode');
    refreshProfileChip(existingUser);
  } else {
    showHomePanel('profile');
  }

  refreshLeaderboard();
}

function refreshProfileChip(user) {
  chipAvatar.textContent = user.avatar;
  chipName.textContent = user.username;
  chipStats.textContent = `${user.wins}W · ${user.losses}L · ${user.draws}D`;
}

function refreshLeaderboard() {
  const users = auth.getAllUsers().sort((a, b) => b.wins - a.wins);
  if (users.length === 0) {
    leaderboardList.innerHTML = '<p class="empty-msg">No players yet. Be the first!</p>';
    return;
  }
  leaderboardList.innerHTML = users.slice(0, 8).map((u, i) => `
    <div class="lb-row">
      <span class="lb-rank">#${i + 1}</span>
      <span class="lb-av">${u.avatar}</span>
      <span class="lb-name">${u.username}</span>
      <span class="lb-wins">${u.wins}W</span>
      <span class="lb-games">${u.gamesPlayed} matches</span>
    </div>
  `).join('');
}

/* ============================================================
   EVENT BINDINGS — HOME
   ============================================================ */
// Auth tab switch
tabRegister.addEventListener('click', () => {
  tabRegister.classList.add('active');
  tabLogin.classList.remove('active');
  panelReg.classList.add('active');
  panelLogin.classList.remove('active');
});
tabLogin.addEventListener('click', () => {
  tabLogin.classList.add('active');
  tabRegister.classList.remove('active');
  panelLogin.classList.add('active');
  panelReg.classList.remove('active');
});

// Register
btnRegister.addEventListener('click', () => {
  const username = regUsernameInput.value.trim();
  if (!username) {
    setHint(regUsernameHint, 'Please enter a username.', 'err');
    regUsernameInput.classList.add('error');
    return;
  }
  const result = auth.register(username, regAvatar);
  if (!result.success) {
    setHint(regUsernameHint, result.error, 'err');
    regUsernameInput.classList.add('error');
    regUsernameInput.classList.remove('success');
    return;
  }
  state.p1User = result.user;
  refreshProfileChip(result.user);
  showHomePanel('mode');
  refreshLeaderboard();
});

// Username uniqueness live check on register input
regUsernameInput.addEventListener('input', () => {
  const v = regUsernameInput.value.trim();
  if (!v) { clearHint(regUsernameHint); regUsernameInput.classList.remove('error', 'success'); return; }
  if (v.length < 2) {
    setHint(regUsernameHint, 'Too short (min 2 chars).', 'err');
    regUsernameInput.classList.add('error');
    regUsernameInput.classList.remove('success');
    return;
  }
  if (auth.isUsernameTaken(v)) {
    setHint(regUsernameHint, `"${v}" is already taken.`, 'err');
    regUsernameInput.classList.add('error');
    regUsernameInput.classList.remove('success');
  } else {
    setHint(regUsernameHint, '✓ Name is available!', 'ok');
    regUsernameInput.classList.remove('error');
    regUsernameInput.classList.add('success');
  }
});

// Login
btnLogin.addEventListener('click', () => {
  const username = loginUsernameInput.value.trim();
  if (!username) {
    setHint(loginHint, 'Please enter your username.', 'err');
    return;
  }
  const result = auth.login(username);
  if (!result.success) {
    setHint(loginHint, result.error, 'err');
    loginUsernameInput.classList.add('error');
    return;
  }
  state.p1User = result.user;
  refreshProfileChip(result.user);
  showHomePanel('mode');
  refreshLeaderboard();
});

// Change user
btnChangeUser.addEventListener('click', () => {
  auth.logout();
  state.p1User = null;
  regUsernameInput.value = '';
  loginUsernameInput.value = '';
  clearHint(regUsernameHint);
  clearHint(loginHint);
  showHomePanel('profile');
});

// Mode Buttons
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    state.mode = mode;

    if (mode === 'offline') {
      offlineP2Input.value = '';
      clearHint(offlineP2Hint);
      showHomePanel('offline-p2');
    } else if (mode === 'online') {
      showHomePanel('online-lobby');
      showOnlineLobby(true);
    } else {
      // AI modes — start immediately
      state.p2User = null;
      startGame();
    }
  });
});

// Offline P2 setup
btnOfflineBack.addEventListener('click', () => showHomePanel('mode'));
btnOfflineStart.addEventListener('click', () => {
  const p2Name = offlineP2Input.value.trim();
  if (!p2Name || p2Name.length < 2) {
    setHint(offlineP2Hint, 'Enter a name (min 2 chars).', 'err');
    return;
  }
  // Must be different from P1
  if (p2Name.toLowerCase() === state.p1User.id) {
    setHint(offlineP2Hint, 'Player 2 must have a different name than Player 1.', 'err');
    offlineP2Input.classList.add('error');
    return;
  }
  state.p2User = {
    id: p2Name.toLowerCase(),
    username: p2Name,
    avatar: offlineP2Avatar,
    wins: 0, losses: 0, draws: 0, gamesPlayed: 0
  };
  startGame();
});

// Live check for P2 name conflict
offlineP2Input.addEventListener('input', () => {
  const v = offlineP2Input.value.trim();
  if (!v) { clearHint(offlineP2Hint); offlineP2Input.classList.remove('error', 'success'); return; }
  if (state.p1User && v.toLowerCase() === state.p1User.id) {
    setHint(offlineP2Hint, 'Must be different from Player 1.', 'err');
    offlineP2Input.classList.add('error');
    offlineP2Input.classList.remove('success');
  } else if (v.length >= 2) {
    setHint(offlineP2Hint, '✓ Good to go!', 'ok');
    offlineP2Input.classList.remove('error');
    offlineP2Input.classList.add('success');
  } else {
    clearHint(offlineP2Hint);
  }
});

// Online lobby
btnOnlineBack.addEventListener('click', () => {
  if (onlineEngine) { onlineEngine.disconnect(); onlineEngine = null; }
  showOnlineLobby(false);
  showHomePanel('mode');
});

btnCreateRoom.addEventListener('click', async () => {
  initOnlineEngine();
  roomCodeDisplay.classList.add('hidden');
  btnCreateRoom.disabled = true;
  btnCreateRoom.textContent = '⏳ Setting up...';
  await onlineEngine.createRoom(state.p1User);
  btnCreateRoom.disabled = false;
  btnCreateRoom.textContent = '➕ Create Room';
});

btnJoinRoom.addEventListener('click', async () => {
  const code = inputJoinCode.value.trim().toUpperCase();
  if (!code) { joinStatusMsg.textContent = 'Enter a room code.'; joinStatusMsg.className = 'input-hint err'; return; }
  initOnlineEngine();
  joinStatusMsg.textContent = 'Connecting...';
  joinStatusMsg.className = 'input-hint';
  await onlineEngine.joinRoom(code, state.p1User);
});

btnCopyRoomCode.addEventListener('click', () => {
  navigator.clipboard.writeText(roomCodeValue.textContent).then(() => {
    btnCopyRoomCode.textContent = '✅ Copied!';
    setTimeout(() => { btnCopyRoomCode.textContent = '📋 Copy'; }, 2000);
  });
});

/* ============================================================
   GAME STARTUP
   ============================================================ */
function startGame() {
  // Configure names and avatars
  const p1 = state.p1User;
  const mode = state.mode;

  p1NameEl.textContent  = p1.username;
  p1AvatarEl.textContent = p1.avatar;

  if (mode === 'offline') {
    const p2 = state.p2User;
    p2NameEl.textContent  = p2.username;
    p2AvatarEl.textContent = p2.avatar;
    btnUndo.style.display = '';
  } else if (mode === 'ai_easy') {
    p2NameEl.textContent  = 'AI (Casual)';
    p2AvatarEl.textContent = '🤖';
    btnUndo.style.display = '';
  } else if (mode === 'ai_smart') {
    p2NameEl.textContent  = 'AI (Smart)';
    p2AvatarEl.textContent = '🧠';
    btnUndo.style.display = '';
  }

  // Hide undo in online
  btnUndo.style.display = (mode === 'online') ? 'none' : '';

  resetGameState();
  showScreen('game');
  showHomePanel('mode');
}

function startOnlineGame() {
  const p1 = state.p1User;
  const myIdx = state.myOnlineIndex;

  if (myIdx === 1) {
    // I am Host → P1
    p1NameEl.textContent  = p1.username;
    p1AvatarEl.textContent = p1.avatar;
    p2NameEl.textContent  = 'Opponent';
    p2AvatarEl.textContent = '👾';
  } else {
    // I am Joiner → P2
    p2NameEl.textContent  = p1.username;
    p2AvatarEl.textContent = p1.avatar;
    p1NameEl.textContent  = 'Opponent';
    p1AvatarEl.textContent = '👾';
  }

  btnUndo.style.display = 'none';
  resetGameState();
  showScreen('game');
}

function resetGameState() {
  state.game.reset();
  state.isAiThinking = false;
  clearBanner();
  initBoardSVG();
  updateGameUI();
  turnTimer.start();
}

/* ============================================================
   BOARD SVG GENERATION
   ============================================================ */
function initBoardSVG() {
  const boxSize = 62;
  const padding = 34;
  const W = padding * 2 + (BOARD_CONFIG.DOT_COLS - 1) * boxSize;
  const H = padding * 2 + (BOARD_CONFIG.DOT_ROWS - 1) * boxSize;

  boardSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  boardSvg.innerHTML = '';
  const ns = 'http://www.w3.org/2000/svg';

  const mkEl = (tag, attrs) => {
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };

  // ── Boxes
  const boxG = mkEl('g', { id: 'boxes-layer' });
  for (let r = 0; r < BOARD_CONFIG.BOX_ROWS; r++) {
    for (let c = 0; c < BOARD_CONFIG.BOX_COLS; c++) {
      const x = padding + c * boxSize, y = padding + r * boxSize;
      const g = mkEl('g', { class: 'box-item', id: `box-${r}-${c}` });
      g.appendChild(mkEl('rect', { x, y, width: boxSize, height: boxSize, class: 'box-rect', rx: 5, ry: 5 }));
      const txt = mkEl('text', { x: x + boxSize / 2, y: y + boxSize / 2 + 6, 'text-anchor': 'middle', class: 'box-label' });
      txt.textContent = '';
      g.appendChild(txt);
      boxG.appendChild(g);
    }
  }
  boardSvg.appendChild(boxG);

  // ── Lines
  const lineG = mkEl('g', { id: 'lines-layer' });

  // Horizontal (8 rows × 7 cols = 56)
  for (let r = 0; r < BOARD_CONFIG.DOT_ROWS; r++) {
    for (let c = 0; c < BOARD_CONFIG.BOX_COLS; c++) {
      const x1 = padding + c * boxSize, y = padding + r * boxSize, x2 = x1 + boxSize;
      const g = mkEl('g', { class: 'line-group horizontal-line', id: `h-line-${r}-${c}` });
      g.appendChild(mkEl('line', { x1, y1: y, x2, y2: y, class: 'grid-line' }));
      g.appendChild(mkEl('line', { x1, y1: y, x2, y2: y, class: 'line-hitarea' }));
      g.addEventListener('click', () => handleLineClick('h', r, c));
      lineG.appendChild(g);
    }
  }

  // Vertical (7 rows × 8 cols = 56)
  for (let r = 0; r < BOARD_CONFIG.BOX_ROWS; r++) {
    for (let c = 0; c < BOARD_CONFIG.DOT_COLS; c++) {
      const x = padding + c * boxSize, y1 = padding + r * boxSize, y2 = y1 + boxSize;
      const g = mkEl('g', { class: 'line-group vertical-line', id: `v-line-${r}-${c}` });
      g.appendChild(mkEl('line', { x1: x, y1, x2: x, y2, class: 'grid-line' }));
      g.appendChild(mkEl('line', { x1: x, y1, x2: x, y2, class: 'line-hitarea' }));
      g.addEventListener('click', () => handleLineClick('v', r, c));
      lineG.appendChild(g);
    }
  }
  boardSvg.appendChild(lineG);

  // ── Dots (8×8 = 64)
  const dotG = mkEl('g', { id: 'dots-layer' });
  for (let r = 0; r < BOARD_CONFIG.DOT_ROWS; r++) {
    for (let c = 0; c < BOARD_CONFIG.DOT_COLS; c++) {
      dotG.appendChild(mkEl('circle', {
        cx: padding + c * boxSize,
        cy: padding + r * boxSize,
        r: 5.5, class: 'grid-dot'
      }));
    }
  }
  boardSvg.appendChild(dotG);
}

/* ============================================================
   MOVE PROCESSING
   ============================================================ */
function handleLineClick(type, row, col) {
  if (state.game.isGameOver || state.isAiThinking) return;

  const curr = state.game.currentPlayer;

  // Online: only accept clicks when it's MY turn
  if (state.mode === 'online') {
    if (curr !== state.myOnlineIndex) return;
  }
  // AI modes: block clicks when AI is thinking (P2's turn)
  if (state.mode === 'ai_easy' || state.mode === 'ai_smart') {
    if (curr === PLAYERS.PLAYER_2) return;
  }

  const res = processMove(type, row, col, true /* local */);
  if (res && res.success && state.mode === 'online' && onlineEngine) {
    onlineEngine.sendMove(type, row, col);
  }
}

function processMove(type, row, col, isLocal) {
  const result = state.game.makeMove(type, row, col);
  if (!result.success) return result;

  const player = result.move.player;
  sound.playLineClick();

  // ── Highlight line
  const lineEl = document.getElementById(`${type}-line-${row}-${col}`);
  if (lineEl) {
    lineEl.classList.add('drawn', `player-${player}`);
    lineEl.classList.add('just-drawn');
    setTimeout(() => lineEl.classList.remove('just-drawn'), 400);
  }

  // ── Animate claimed boxes
  if (result.completedBoxes.length > 0) {
    sound.playBoxComplete(result.completedBoxes.length > 1);
    const avatar = player === 1 ? p1AvatarEl.textContent : p2AvatarEl.textContent;
    result.completedBoxes.forEach(({ row: r, col: c }) => {
      const boxEl = document.getElementById(`box-${r}-${c}`);
      if (boxEl) {
        boxEl.classList.add('claimed', `player-${player}`);
        const txt = boxEl.querySelector('.box-label');
        if (txt) txt.textContent = avatar;
      }
    });
    const extra = result.completedBoxes.length === 1 ? '+1 BOX!' : '+2 BOXES!';
    showBanner(`${extra} EXTRA TURN!`, player);
  }

  // ── Restart timer (stop on game over)
  if (result.isGameOver) {
    turnTimer.stop();
  } else {
    turnTimer.start();
  }

  updateGameUI();

  if (result.isGameOver) {
    sound.playGameOver();
    resolveMatchEnd(result.winner);
    return result;
  }

  // AI move
  if ((state.mode === 'ai_easy' || state.mode === 'ai_smart') && state.game.currentPlayer === PLAYERS.PLAYER_2) {
    scheduleAiMove();
  }

  return result;
}

function scheduleAiMove() {
  state.isAiThinking = true;
  setTimeout(() => {
    if (state.game.isGameOver) { state.isAiThinking = false; return; }
    const aiMove = DotsAndBoxesAI.getMove(state.game, state.mode === 'ai_smart' ? 'vs_ai_smart' : 'vs_ai_easy');
    state.isAiThinking = false;
    if (aiMove) processMove(aiMove.type, aiMove.row, aiMove.col, false);
  }, 480);
}

/* ============================================================
   TURN TIMEOUT
   ============================================================ */
function handleTurnTimeout(fromRemote = false) {
  if (state.game.isGameOver) return;

  const result = state.game.handleTimeout();
  if (!result.success) return;

  sound.playTimeout();
  showBanner(`⏰ TIME'S UP! TURN SKIPPED`, result.skippedPlayer);

  // In online mode, broadcast timeout to peer (only if this happened locally)
  if (!fromRemote && state.mode === 'online' && onlineEngine && result.skippedPlayer === state.myOnlineIndex) {
    onlineEngine.sendTimeout();
  }

  updateGameUI();
  turnTimer.start();

  // If AI's turn after timeout
  if ((state.mode === 'ai_easy' || state.mode === 'ai_smart') && state.game.currentPlayer === PLAYERS.PLAYER_2) {
    scheduleAiMove();
  }
}

/* ============================================================
   DISCONNECT WIN (Online)
   ============================================================ */
function showDisconnectWin(winnerIndex) {
  const winnerName = winnerIndex === 1 ? p1NameEl.textContent : p2NameEl.textContent;
  const winnerAvatar = winnerIndex === 1 ? p1AvatarEl.textContent : p2AvatarEl.textContent;

  recordMatchStats('disconnect_win', winnerIndex);

  winnerTrophy.textContent = '🏆';
  modalWinnerTitle.textContent = `${winnerName} Wins!`;
  modalWinnerTitle.style.color = winnerIndex === 1 ? 'var(--p1)' : 'var(--p2)';
  modalSubtitle.textContent = 'Opponent disconnected from the game.';
  modalP1Label.textContent = p1NameEl.textContent;
  modalP2Label.textContent = p2NameEl.textContent;
  modalP1Avatar.textContent = p1AvatarEl.textContent;
  modalP2Avatar.textContent = p2AvatarEl.textContent;
  modalP1Score.textContent = state.game.scores[1];
  modalP2Score.textContent = state.game.scores[2];

  gameOverModal.classList.add('active');
}

/* ============================================================
   MATCH END & STAT RECORDING
   ============================================================ */
function resolveMatchEnd(winner) {
  recordMatchStats('normal', winner);

  const p1Score = state.game.scores[1];
  const p2Score = state.game.scores[2];

  if (winner === 'DRAW') {
    winnerTrophy.textContent = '🤝';
    modalWinnerTitle.textContent = "It's a Draw!";
    modalWinnerTitle.style.color = 'var(--gold)';
    modalSubtitle.textContent = 'Both players scored equally!';
  } else {
    const winnerName = winner === 1 ? p1NameEl.textContent : p2NameEl.textContent;
    winnerTrophy.textContent = '🏆';
    modalWinnerTitle.textContent = `${winnerName} Wins!`;
    modalWinnerTitle.style.color = winner === 1 ? 'var(--p1)' : 'var(--p2)';
    modalSubtitle.textContent = `${winner === 1 ? p1Score : p2Score} boxes claimed out of 49!`;
  }

  modalP1Label.textContent = p1NameEl.textContent;
  modalP2Label.textContent = p2NameEl.textContent;
  modalP1Avatar.textContent = p1AvatarEl.textContent;
  modalP2Avatar.textContent = p2AvatarEl.textContent;
  modalP1Score.textContent = p1Score;
  modalP2Score.textContent = p2Score;

  setTimeout(() => gameOverModal.classList.add('active'), 400);
}

function recordMatchStats(type, winner) {
  if (!state.p1User) return;

  if (type === 'disconnect_win') {
    // winner = myOnlineIndex → I won because opponent left
    if (winner === state.myOnlineIndex) {
      auth.recordMatch(state.p1User.id, 'win');
    } else {
      auth.recordMatch(state.p1User.id, 'loss');
    }
    return;
  }

  // Normal finish
  if (winner === 'DRAW') {
    auth.recordMatch(state.p1User.id, 'draw');
    // In offline mode, also record for P2 if they have an account
  } else if (winner === 1) {
    auth.recordMatch(state.p1User.id, state.mode === 'online' && state.myOnlineIndex === 2 ? 'loss' : 'win');
  } else {
    auth.recordMatch(state.p1User.id, state.mode === 'online' && state.myOnlineIndex === 1 ? 'loss' : 'win');
  }
}

/* ============================================================
   UI UPDATE
   ============================================================ */
function updateGameUI() {
  const p1Score = state.game.scores[1];
  const p2Score = state.game.scores[2];
  const completed = state.game.completedBoxes;

  p1ScoreEl.textContent = p1Score;
  p2ScoreEl.textContent = p2Score;
  boxesCompletedEl.textContent = completed;
  boxesLeftEl.textContent = BOARD_CONFIG.TOTAL_BOXES - completed;

  const p1Pct = (p1Score / BOARD_CONFIG.TOTAL_BOXES) * 100;
  const p2Pct = (p2Score / BOARD_CONFIG.TOTAL_BOXES) * 100;
  progressP1.style.width = `${p1Pct}%`;
  progressP2.style.width = `${p2Pct}%`;

  const curr = state.game.currentPlayer;

  if (curr === PLAYERS.PLAYER_1) {
    p1CardEl.classList.add('active'); p2CardEl.classList.remove('active');
    turnIndicatorEl.className = 'turn-indicator player-1-active';
    turnIndicatorEl.innerHTML = `<span class="turn-dot player-1-dot"></span><span id="turn-text">${p1NameEl.textContent}'s Turn</span>`;
  } else {
    p2CardEl.classList.add('active'); p1CardEl.classList.remove('active');
    turnIndicatorEl.className = 'turn-indicator player-2-active';
    turnIndicatorEl.innerHTML = `<span class="turn-dot player-2-dot"></span><span id="turn-text">${p2NameEl.textContent}'s Turn</span>`;
  }

  btnUndo.disabled = state.game.moveHistory.length === 0 || state.isAiThinking;
}

/* ============================================================
   BANNER
   ============================================================ */
function showBanner(msg, player) {
  if (state.bannerTimeout) clearTimeout(state.bannerTimeout);
  bannerTextEl.textContent = msg;
  bannerEl.className = `game-banner show player-${player}`;
  state.bannerTimeout = setTimeout(() => bannerEl.classList.remove('show'), 1300);
}

function clearBanner() {
  if (state.bannerTimeout) clearTimeout(state.bannerTimeout);
  bannerEl.className = 'game-banner';
}

/* ============================================================
   IN-GAME CONTROLS
   ============================================================ */
btnNewGame.addEventListener('click', () => {
  gameOverModal.classList.remove('active');
  resetGameState();
});

btnPlayAgain.addEventListener('click', () => {
  gameOverModal.classList.remove('active');
  resetGameState();
});

btnGoHome.addEventListener('click', () => {
  gameOverModal.classList.remove('active');
  exitToHome();
});

btnMute.addEventListener('click', () => {
  const muted = sound.toggleMute();
  btnMute.textContent = muted ? '🔇' : '🔊';
});

btnUndo.addEventListener('click', () => {
  if (state.game.moveHistory.length === 0 || state.isAiThinking) return;

  // In AI mode, undo AI move + player move together
  if (state.mode === 'ai_easy' || state.mode === 'ai_smart') {
    // Undo until it's P1's turn again
    while (state.game.moveHistory.length > 0) {
      const un = state.game.undoMove();
      if (un && un.player === PLAYERS.PLAYER_1) break;
    }
  } else {
    state.game.undoMove();
  }

  // Redraw board
  initBoardSVG();
  // Replay existing history visually
  const hist = [...state.game.moveHistory];
  state.game.reset();
  hist.forEach(mv => {
    const res = state.game.makeMove(mv.type, mv.row, mv.col);
    const lineEl = document.getElementById(`${mv.type}-line-${mv.row}-${mv.col}`);
    if (lineEl) lineEl.classList.add('drawn', `player-${mv.player}`);
    if (res.completedBoxes.length > 0) {
      const av = mv.player === 1 ? p1AvatarEl.textContent : p2AvatarEl.textContent;
      res.completedBoxes.forEach(({ row: r, col: c }) => {
        const boxEl = document.getElementById(`box-${r}-${c}`);
        if (boxEl) {
          boxEl.classList.add('claimed', `player-${mv.player}`);
          const txt = boxEl.querySelector('.box-label');
          if (txt) txt.textContent = av;
        }
      });
    }
  });

  updateGameUI();
  turnTimer.start();
});

// Exit button (with forfeit confirm in online)
btnExitGame.addEventListener('click', () => {
  if (state.mode === 'online' && !state.game.isGameOver) {
    exitConfirmModal.classList.add('active');
  } else {
    exitToHome();
  }
});

btnConfirmExit.addEventListener('click', () => {
  exitConfirmModal.classList.remove('active');
  // Forfeit: opponent wins
  if (onlineEngine && onlineEngine.isConnected()) {
    // Disconnect triggers opponent's onDisconnected → they win
    onlineEngine.disconnect();
    onlineEngine = null;
  }
  auth.recordMatch(state.p1User.id, 'loss');
  exitToHome();
});

btnCancelExit.addEventListener('click', () => {
  exitConfirmModal.classList.remove('active');
});

function exitToHome() {
  turnTimer.stop();
  clearBanner();
  gameOverModal.classList.remove('active');
  exitConfirmModal.classList.remove('active');
  if (onlineEngine) { onlineEngine.disconnect(); onlineEngine = null; }
  refreshProfileChip(auth.getCurrentUser() || state.p1User);
  refreshLeaderboard();
  showHomePanel('mode');
  showScreen('home');
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  showScreen('home');
  initHomeScreen();
});

function setHint(el, msg, cls) {
  el.textContent = msg;
  el.className = `input-hint ${cls}`;
}
function clearHint(el) {
  el.textContent = '';
  el.className = 'input-hint';
}
