import { BOARD_CONFIG, PLAYERS } from './constants.js';
import { DotsAndBoxesGame } from './gameLogic.js';
import { DotsAndBoxesAI } from './ai.js';
import { sound } from './audio.js';
import { auth } from './auth.js';
import { TurnTimer } from './timer.js';
import { OnlineMultiplayerEngine } from './online.js';
import { NETWORK_ACTIONS } from './constants.js';

/* ═══════════════════════════════════════════════════════════════════════════
   GLOBAL STATE
═══════════════════════════════════════════════════════════════════════════ */
const state = {
  mode: null,           // 'offline' | 'online' | 'ai_easy' | 'ai_smart'
  p1User: null,         // profile of logged-in user (always player 1 locally)
  p2User: null,         // profile for offline P2
  myOnlineIndex: 1,     // which seat I occupy in online (1 or 2)
  pendingFbUser: null,  // Firebase user after auth, before username set
  game: new DotsAndBoxesGame(),
  isAiThinking: false,
  bannerTo: null,
};

let onlineEngine = null;

/* ═══════════════════════════════════════════════════════════════════════════
   DOM HELPERS
═══════════════════════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);

/* ─ Screens ───────────────────────────────────────────────────────────── */
const S_AUTH  = $('screen-auth');
const S_HOME  = $('screen-home');
const S_LOBBY = $('screen-lobby');
const S_GAME  = $('screen-game');
const ALL_SCREENS = [S_AUTH, S_HOME, S_LOBBY, S_GAME];

function showScreen(el) {
  ALL_SCREENS.forEach(s => s.classList.remove('active'));
  el.classList.add('active');
}

/* ─ Auth ──────────────────────────────────────────────────────────────── */
const stepMethod   = $('auth-step-method');
const stepUsername = $('auth-step-username');
const segSignin    = $('seg-signin');
const segSignup    = $('seg-signup');
const formSignin   = $('form-signin');
const formSignup   = $('form-signup');
const btnGoogle    = $('btn-google-signin');
const siEmail      = $('si-email');
const siPassword   = $('si-password');
const siError      = $('si-error');
const btnSigninEmail = $('btn-signin-email');
const suEmail      = $('su-email');
const suPassword   = $('su-password');
const suError      = $('su-error');
const btnSignupEmail = $('btn-signup-email');
const authErrGlobal  = $('auth-error-global');

const previewPhoto   = $('preview-photo');
const previewEmail   = $('preview-email');
const usernameInput  = $('username-input');
const usernameHint   = $('username-hint');
const usernameError  = $('username-error');
const btnSetUsername = $('btn-set-username');
const btnSignoutBack = $('btn-signout-back');

/* ─ Home ──────────────────────────────────────────────────────────────── */
const hcName       = $('hc-name');
const btnHomeSignout = $('btn-home-signout');
const lbList       = $('lb-list');

/* ─ Lobby ─────────────────────────────────────────────────────────────── */
const lobbyOffline = $('lobby-offline');
const lobbyOnline  = $('lobby-online');
const p2NameInput  = $('p2-name-input');
const p2NameHint   = $('p2-name-hint');
const btnOfflineBack  = $('btn-offline-back');
const btnOfflineStart = $('btn-offline-start');
const btnCreateRoom   = $('btn-create-room');
const btnJoinRoom     = $('btn-join-room');
const joinCodeInput   = $('join-code-input');
const joinStatus      = $('join-status');
const roomCodeBox     = $('room-code-box');
const rcValue         = $('rc-value');
const btnCopyCode     = $('btn-copy-code');
const rcStatusText    = $('rc-status-text');
const btnOnlineBack   = $('btn-online-back');

/* ─ Game ──────────────────────────────────────────────────────────────── */
const btnExitGame = $('btn-exit-game');
const btnMute     = $('btn-mute');
const btnUndo     = $('btn-undo');
const btnNewGame  = $('btn-new-game');

const timerCard = $('timer-card');
const timerNum  = $('timer-num');
const timerBar  = $('timer-bar');

const p1Card    = $('p1-card');
const p2Card    = $('p2-card');
const p1Name    = $('p1-name');
const p2Name    = $('p2-name');
const p1Avatar  = $('p1-avatar');
const p2Avatar  = $('p2-avatar');
const p1Score   = $('p1-score');
const p2Score   = $('p2-score');

const turnInd   = $('turn-indicator');
const turnText  = $('turn-text');
const boxesDone = $('boxes-done');
const boxesLeft = $('boxes-left');
const progP1    = $('prog-p1');
const progP2    = $('prog-p2');
const boardSvg  = $('board-svg');
const banner    = $('game-banner');
const bannerTxt = $('banner-txt');

/* ─ Modals ────────────────────────────────────────────────────────────── */
const modalGameover = $('modal-gameover');
const modalExit     = $('modal-exit');
const goTrophy      = $('go-trophy');
const goTitle       = $('go-title');
const goSub         = $('go-sub');
const goP1Name      = $('go-p1-name');
const goP2Name      = $('go-p2-name');
const goP1Score     = $('go-p1-score');
const goP2Score     = $('go-p2-score');
const btnPlayAgain  = $('btn-play-again');
const btnGoHome     = $('btn-go-home');
const btnConfirmExit = $('btn-confirm-exit');
const btnCancelExit  = $('btn-cancel-exit');

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════════════ */
function setHint(el, msg, cls = '') {
  el.textContent = msg;
  el.className = `field-hint${cls ? ' ' + cls : ''}`;
}
function showErr(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideErr(el) { el.classList.add('hidden'); el.textContent = ''; }

function abbrev(name, maxLen = 10) {
  return name.length > maxLen ? name.slice(0, maxLen - 1) + '…' : name;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TURN TIMER
═══════════════════════════════════════════════════════════════════════════ */
const turnTimer = new TurnTimer({
  duration: 20,
  warningThreshold: 5,
  onTick(s, pct) {
    timerNum.textContent = s;
    timerBar.style.width = `${pct}%`;
    if (s <= 5)  timerCard.className = 'timer-card danger';
    else if (s <= 10) timerCard.className = 'timer-card warning';
    else timerCard.className = 'timer-card normal';
  },
  onWarning() { sound.playTimerTick?.(); },
  onTimeout:  handleTurnTimeout,
});

/* ═══════════════════════════════════════════════════════════════════════════
   ONLINE ENGINE FACTORY
═══════════════════════════════════════════════════════════════════════════ */
function createOnlineEngine() {
  if (onlineEngine) { onlineEngine.disconnect(); onlineEngine = null; }

  onlineEngine = new OnlineMultiplayerEngine({
    onStatusChange(status, msg) {
      rcStatusText.textContent = msg;
      joinStatus.textContent   = msg;
    },
    onRoomReady(code) {
      rcValue.textContent = code;
      roomCodeBox.classList.remove('hidden');
    },
    onOpponentJoined(info) {
      state.myOnlineIndex = info.playerIndex;
      closeLobby();
      startOnlineGame();
    },
    onOpponentProfileReceived(profile) {
      const oppIdx = state.myOnlineIndex === 1 ? 2 : 1;
      const nameEl  = oppIdx === 1 ? p1Name  : p2Name;
      const avEl    = oppIdx === 1 ? p1Avatar : p2Avatar;
      nameEl.textContent = abbrev(profile.username || 'Opponent');
      avEl.textContent   = profile.username ? profile.username.slice(0,2).toUpperCase() : 'OP';
      updateHUD();
    },
    onMoveReceived(move) { processMove(move.type, move.row, move.col, false); },
    onTimeoutReceived()  { handleTurnTimeout(true); },
    onRestartReceived()  { resetGameState(); },
    onDisconnected()     {
      if (state.game.isGameOver) return;
      turnTimer.stop();
      showDisconnectWin(state.myOnlineIndex);
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   AUTH SCREEN EVENTS
═══════════════════════════════════════════════════════════════════════════ */

/* Tab switch */
segSignin.addEventListener('click', () => {
  segSignin.classList.add('active'); segSignup.classList.remove('active');
  formSignin.classList.add('active'); formSignup.classList.remove('active');
  hideErr(siError); hideErr(suError);
});
segSignup.addEventListener('click', () => {
  segSignup.classList.add('active'); segSignin.classList.remove('active');
  formSignup.classList.add('active'); formSignin.classList.remove('active');
  hideErr(siError); hideErr(suError);
});

/* Google sign-in */
btnGoogle.addEventListener('click', async () => {
  hideErr(authErrGlobal);
  btnGoogle.disabled = true;
  btnGoogle.textContent = 'Signing in…';
  try {
    const fbUser = await auth.signInWithGoogle();
    await afterFirebaseAuth(fbUser);
  } catch (e) {
    showErr(authErrGlobal, e.message);
    btnGoogle.disabled = false;
    btnGoogle.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg> Continue with Google`;
  }
});

/* Email sign-in */
btnSigninEmail.addEventListener('click', async () => {
  hideErr(siError);
  const email = siEmail.value.trim();
  const pass  = siPassword.value;
  if (!email || !pass) { showErr(siError, 'Enter email and password.'); return; }
  btnSigninEmail.disabled = true; btnSigninEmail.textContent = 'Signing in…';
  try {
    const fbUser = await auth.signInWithEmail(email, pass);
    await afterFirebaseAuth(fbUser);
  } catch (e) {
    showErr(siError, e.message);
  } finally {
    btnSigninEmail.disabled = false; btnSigninEmail.textContent = 'Sign In →';
  }
});

/* Email sign-up */
btnSignupEmail.addEventListener('click', async () => {
  hideErr(suError);
  const email = suEmail.value.trim();
  const pass  = suPassword.value;
  if (!email) { showErr(suError, 'Enter your email address.'); return; }
  if (!pass || pass.length < 6) { showErr(suError, 'Password must be at least 6 characters.'); return; }
  btnSignupEmail.disabled = true; btnSignupEmail.textContent = 'Creating…';
  try {
    const fbUser = await auth.signUpWithEmail(email, pass);
    await afterFirebaseAuth(fbUser);
  } catch (e) {
    showErr(suError, e.message);
  } finally {
    btnSignupEmail.disabled = false; btnSignupEmail.textContent = 'Create Account →';
  }
});

/**
 * Called after Firebase auth succeeds.
 * If the UID already has a stored profile → log them in directly.
 * Otherwise → show username step.
 */
async function afterFirebaseAuth(fbUser) {
  hideErr(authErrGlobal);

  // Check if this UID already has a username registered
  const existing = auth.getProfileByUid(fbUser.uid);
  if (existing) {
    // Restore session
    const result = auth.setUsername(fbUser.uid, existing.username, fbUser.email, fbUser.photo);
    if (result.success) {
      state.p1User = result.user;
      enterHome();
      return;
    }
  }

  // New user or no username yet → show username step
  state.pendingFbUser = fbUser;

  // Pre-fill suggested username from Google display name
  const suggested = fbUser.displayName
    ? fbUser.displayName.replace(/\s+/g, '').slice(0, 16)
    : '';
  usernameInput.value = suggested;
  previewEmail.textContent = fbUser.email || fbUser.uid;
  previewPhoto.textContent = fbUser.photo ? '' : (fbUser.email || '?')[0].toUpperCase();
  if (fbUser.photo) {
    const img = document.createElement('img');
    img.src = fbUser.photo;
    img.style.cssText = 'width:28px;height:28px;border-radius:50%;object-fit:cover;';
    previewPhoto.innerHTML = '';
    previewPhoto.appendChild(img);
  }

  if (suggested) checkUsernameAvailability(suggested);

  stepMethod.classList.remove('active');
  stepUsername.classList.add('active');
}

/* Live username availability check */
usernameInput.addEventListener('input', () => {
  const v = usernameInput.value.trim();
  if (!v) { setHint(usernameHint, ''); usernameInput.classList.remove('err','ok'); return; }
  checkUsernameAvailability(v);
});

function checkUsernameAvailability(name) {
  if (name.length < 2) {
    setHint(usernameHint, 'Too short (min 2 characters).', 'err');
    usernameInput.classList.add('err'); usernameInput.classList.remove('ok');
    return false;
  }
  const taken = auth.isUsernameTaken(name, state.pendingFbUser?.uid);
  if (taken) {
    setHint(usernameHint, `"${name}" is taken — try another.`, 'err');
    usernameInput.classList.add('err'); usernameInput.classList.remove('ok');
    return false;
  }
  setHint(usernameHint, '✓ Available', 'ok');
  usernameInput.classList.remove('err'); usernameInput.classList.add('ok');
  return true;
}

/* Set username and enter home */
btnSetUsername.addEventListener('click', () => {
  hideErr(usernameError);
  const name = usernameInput.value.trim();
  if (!checkUsernameAvailability(name)) {
    showErr(usernameError, usernameHint.textContent);
    return;
  }
  const fb = state.pendingFbUser;
  if (!fb) return;
  const result = auth.setUsername(fb.uid, name, fb.email, fb.photo);
  if (!result.success) { showErr(usernameError, result.error); return; }
  state.p1User = result.user;
  state.pendingFbUser = null;
  enterHome();
});

/* Go back to sign-in */
btnSignoutBack.addEventListener('click', () => {
  state.pendingFbUser = null;
  stepUsername.classList.remove('active');
  stepMethod.classList.add('active');
  hideErr(usernameError);
});

/* ═══════════════════════════════════════════════════════════════════════════
   HOME SCREEN
═══════════════════════════════════════════════════════════════════════════ */
function enterHome() {
  const u = state.p1User;
  hcName.textContent = u.username;
  refreshLeaderboard();
  showScreen(S_HOME);
}

function refreshLeaderboard() {
  const users = auth.getAllUsers();
  if (!users.length) {
    lbList.innerHTML = '<p class="lb-empty">No matches played yet.</p>';
    return;
  }
  lbList.innerHTML = users.slice(0, 8).map((u, i) => `
    <div class="lb-row">
      <span class="lb-rank">#${i+1}</span>
      <span class="lb-name">${u.username}</span>
      <span class="lb-wins">${u.wins}W</span>
      <span class="lb-games">${u.gamesPlayed}m</span>
    </div>
  `).join('');
}

/* Sign out */
btnHomeSignout.addEventListener('click', () => {
  auth.logout();
  state.p1User = null;
  stepUsername.classList.remove('active');
  stepMethod.classList.add('active');
  siEmail.value = ''; siPassword.value = '';
  hideErr(siError); hideErr(authErrGlobal);
  showScreen(S_AUTH);
});

/* Mode tiles */
document.querySelectorAll('.mode-tile').forEach(tile => {
  tile.addEventListener('click', () => {
    state.mode = tile.dataset.mode;

    if (state.mode === 'offline') {
      showLobbyPanel('offline');
      showScreen(S_LOBBY);
    } else if (state.mode === 'online') {
      showLobbyPanel('online');
      showScreen(S_LOBBY);
    } else {
      // AI — start directly
      state.p2User = null;
      startGame();
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   LOBBY SCREEN
═══════════════════════════════════════════════════════════════════════════ */
function showLobbyPanel(which) {
  lobbyOffline.classList.toggle('hidden', which !== 'offline');
  lobbyOnline.classList.toggle('hidden',  which !== 'online');
}
function closeLobby() {
  showScreen(S_HOME);
}

/* ── Offline ── */
btnOfflineBack.addEventListener('click', () => { showScreen(S_HOME); });

p2NameInput.addEventListener('input', () => {
  const v = p2NameInput.value.trim();
  if (!v) { setHint(p2NameHint, ''); p2NameInput.classList.remove('err','ok'); return; }
  if (v.toLowerCase() === state.p1User?.username.toLowerCase()) {
    setHint(p2NameHint, 'Must be different from Player 1.', 'err');
    p2NameInput.classList.add('err'); p2NameInput.classList.remove('ok');
  } else if (v.length < 2) {
    setHint(p2NameHint, 'Too short.', 'err');
    p2NameInput.classList.add('err'); p2NameInput.classList.remove('ok');
  } else {
    setHint(p2NameHint, '✓ Good', 'ok');
    p2NameInput.classList.remove('err'); p2NameInput.classList.add('ok');
  }
});

btnOfflineStart.addEventListener('click', () => {
  const name = p2NameInput.value.trim();
  if (!name || name.length < 2) { setHint(p2NameHint, 'Enter a name (min 2 chars).', 'err'); return; }
  if (name.toLowerCase() === state.p1User?.username.toLowerCase()) {
    setHint(p2NameHint, 'Player 2 must have a different name.', 'err'); return;
  }
  state.p2User = { uid: 'local_p2_' + Date.now(), username: name };
  startGame();
});

/* ── Online ── */
btnOnlineBack.addEventListener('click', () => {
  if (onlineEngine) { onlineEngine.disconnect(); onlineEngine = null; }
  showScreen(S_HOME);
});

btnCreateRoom.addEventListener('click', async () => {
  createOnlineEngine();
  roomCodeBox.classList.add('hidden');
  btnCreateRoom.disabled = true;
  btnCreateRoom.textContent = 'Setting up…';
  await onlineEngine.createRoom(state.p1User);
  btnCreateRoom.disabled = false;
  btnCreateRoom.textContent = '+ Create Room';
});

btnJoinRoom.addEventListener('click', async () => {
  const code = joinCodeInput.value.trim().toUpperCase();
  if (!code) { joinStatus.textContent = 'Enter a room code.'; return; }
  createOnlineEngine();
  joinStatus.textContent = 'Connecting…';
  await onlineEngine.joinRoom(code, state.p1User);
});

btnCopyCode.addEventListener('click', () => {
  navigator.clipboard.writeText(rcValue.textContent).then(() => {
    btnCopyCode.textContent = 'copied!';
    setTimeout(() => { btnCopyCode.textContent = 'copy'; }, 2000);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   GAME STARTUP
═══════════════════════════════════════════════════════════════════════════ */
function startGame() {
  const p1 = state.p1User;
  const initials = n => n.slice(0,2).toUpperCase();

  p1Name.textContent   = abbrev(p1.username);
  p1Avatar.textContent = initials(p1.username);

  if (state.mode === 'offline') {
    const p2 = state.p2User;
    p2Name.textContent   = abbrev(p2.username);
    p2Avatar.textContent = initials(p2.username);
    btnUndo.style.display = '';
  } else if (state.mode === 'ai_easy') {
    p2Name.textContent   = 'AI Casual';
    p2Avatar.textContent = 'AI';
    btnUndo.style.display = '';
  } else if (state.mode === 'ai_smart') {
    p2Name.textContent   = 'AI Smart';
    p2Avatar.textContent = 'AI';
    btnUndo.style.display = '';
  }

  btnUndo.style.display = state.mode === 'online' ? 'none' : '';
  resetGameState();
  showScreen(S_GAME);
}

function startOnlineGame() {
  const p1 = state.p1User;
  const initials = n => n.slice(0,2).toUpperCase();
  const myIdx = state.myOnlineIndex;

  if (myIdx === 1) {
    p1Name.textContent   = abbrev(p1.username);
    p1Avatar.textContent = initials(p1.username);
    p2Name.textContent   = 'Opponent';
    p2Avatar.textContent = 'OP';
  } else {
    p2Name.textContent   = abbrev(p1.username);
    p2Avatar.textContent = initials(p1.username);
    p1Name.textContent   = 'Opponent';
    p1Avatar.textContent = 'OP';
  }

  btnUndo.style.display = 'none';
  resetGameState();
  showScreen(S_GAME);
}

function resetGameState() {
  state.game.reset();
  state.isAiThinking = false;
  clearBanner();
  buildBoard();
  updateHUD();
  turnTimer.start();
}

/* ═══════════════════════════════════════════════════════════════════════════
   BOARD SVG
═══════════════════════════════════════════════════════════════════════════ */
function buildBoard() {
  const BOX  = 60;
  const PAD  = 32;
  const ROWS = BOARD_CONFIG.DOT_ROWS;
  const COLS = BOARD_CONFIG.DOT_COLS;
  const W = PAD * 2 + (COLS - 1) * BOX;
  const H = PAD * 2 + (ROWS - 1) * BOX;
  const ns = 'http://www.w3.org/2000/svg';

  boardSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  boardSvg.innerHTML = '';

  const mk = (tag, attrs) => {
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };

  /* Boxes */
  const gBoxes = mk('g', {});
  for (let r = 0; r < BOARD_CONFIG.BOX_ROWS; r++) {
    for (let c = 0; c < BOARD_CONFIG.BOX_COLS; c++) {
      const x = PAD + c * BOX, y = PAD + r * BOX;
      const g = mk('g', { class: 'box-item', id: `box-${r}-${c}` });
      g.appendChild(mk('rect', { x, y, width: BOX, height: BOX, rx: 4, ry: 4, class: 'box-rect' }));
      const t = mk('text', { x: x + BOX/2, y: y + BOX/2 + 5, 'text-anchor': 'middle', class: 'box-label' });
      t.textContent = '';
      g.appendChild(t);
      gBoxes.appendChild(g);
    }
  }
  boardSvg.appendChild(gBoxes);

  /* Lines */
  const gLines = mk('g', {});

  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < BOARD_CONFIG.BOX_COLS; c++) {
      const x1 = PAD + c * BOX, y = PAD + r * BOX, x2 = x1 + BOX;
      const g = mk('g', { class: 'line-group', id: `h-line-${r}-${c}` });
      g.appendChild(mk('line', { x1, y1: y, x2, y2: y, class: 'grid-line' }));
      g.appendChild(mk('line', { x1, y1: y, x2, y2: y, class: 'line-hitarea' }));
      g.addEventListener('click', () => onLineClick('h', r, c));
      gLines.appendChild(g);
    }
  }
  // Vertical
  for (let r = 0; r < BOARD_CONFIG.BOX_ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = PAD + c * BOX, y1 = PAD + r * BOX, y2 = y1 + BOX;
      const g = mk('g', { class: 'line-group', id: `v-line-${r}-${c}` });
      g.appendChild(mk('line', { x1: x, y1, x2: x, y2, class: 'grid-line' }));
      g.appendChild(mk('line', { x1: x, y1, x2: x, y2, class: 'line-hitarea' }));
      g.addEventListener('click', () => onLineClick('v', r, c));
      gLines.appendChild(g);
    }
  }
  boardSvg.appendChild(gLines);

  /* Dots */
  const gDots = mk('g', {});
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      gDots.appendChild(mk('circle', {
        cx: PAD + c * BOX, cy: PAD + r * BOX,
        r: 5, class: 'grid-dot'
      }));
    }
  }
  boardSvg.appendChild(gDots);
}

/* ═══════════════════════════════════════════════════════════════════════════
   MOVE PROCESSING
═══════════════════════════════════════════════════════════════════════════ */
function onLineClick(type, row, col) {
  if (state.game.isGameOver || state.isAiThinking) return;
  const curr = state.game.currentPlayer;
  if (state.mode === 'online' && curr !== state.myOnlineIndex) return;
  if ((state.mode === 'ai_easy' || state.mode === 'ai_smart') && curr === PLAYERS.PLAYER_2) return;

  const res = processMove(type, row, col, true);
  if (res?.success && state.mode === 'online' && onlineEngine) {
    onlineEngine.sendMove(type, row, col);
  }
}

function processMove(type, row, col, isLocal) {
  const result = state.game.makeMove(type, row, col);
  if (!result.success) return result;

  const player = result.move.player;
  sound.playLineClick?.();

  // Update line SVG
  const lineEl = $(`${type}-line-${row}-${col}`);
  if (lineEl) {
    lineEl.classList.add('drawn', `player-${player}`, 'just-drawn');
    setTimeout(() => lineEl.classList.remove('just-drawn'), 350);
  }

  // Update claimed boxes
  if (result.completedBoxes.length > 0) {
    sound.playBoxComplete?.(result.completedBoxes.length > 1);
    const initials = player === 1 ? p1Avatar.textContent : p2Avatar.textContent;
    result.completedBoxes.forEach(({ row: r, col: c }) => {
      const boxEl = $(`box-${r}-${c}`);
      if (boxEl) {
        boxEl.classList.add('claimed', `player-${player}`);
        const t = boxEl.querySelector('.box-label');
        if (t) t.textContent = initials;
      }
    });
    showBanner(
      result.completedBoxes.length === 1 ? '+1 · EXTRA TURN' : `+${result.completedBoxes.length} · EXTRA TURN`,
      player
    );
  }

  if (result.isGameOver) {
    turnTimer.stop();
    updateHUD();
    sound.playGameOver?.();
    setTimeout(() => resolveMatchEnd(result.winner), 300);
    return result;
  }

  turnTimer.start();
  updateHUD();

  if ((state.mode === 'ai_easy' || state.mode === 'ai_smart') && state.game.currentPlayer === PLAYERS.PLAYER_2) {
    scheduleAI();
  }

  return result;
}

function scheduleAI() {
  state.isAiThinking = true;
  setTimeout(() => {
    if (state.game.isGameOver) { state.isAiThinking = false; return; }
    const mv = DotsAndBoxesAI.getMove(state.game, state.mode === 'ai_smart' ? 'vs_ai_smart' : 'vs_ai_easy');
    state.isAiThinking = false;
    if (mv) processMove(mv.type, mv.row, mv.col, false);
  }, 500);
}

/* ═══════════════════════════════════════════════════════════════════════════
   TIMEOUT
═══════════════════════════════════════════════════════════════════════════ */
function handleTurnTimeout(fromRemote = false) {
  if (state.game.isGameOver) return;
  const result = state.game.handleTimeout();
  if (!result.success) return;

  sound.playTimeout?.();
  showBanner('TIME\'S UP — TURN SKIPPED', result.skippedPlayer, 'neutral');

  if (!fromRemote && state.mode === 'online' && onlineEngine && result.skippedPlayer === state.myOnlineIndex) {
    onlineEngine.sendTimeout();
  }

  updateHUD();
  turnTimer.start();

  if ((state.mode === 'ai_easy' || state.mode === 'ai_smart') && state.game.currentPlayer === PLAYERS.PLAYER_2) {
    scheduleAI();
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   HUD UPDATE
═══════════════════════════════════════════════════════════════════════════ */
function updateHUD() {
  const s1 = state.game.scores[1];
  const s2 = state.game.scores[2];
  const done = state.game.completedBoxes;

  p1Score.textContent = s1;
  p2Score.textContent = s2;
  boxesDone.textContent = done;
  boxesLeft.textContent = BOARD_CONFIG.TOTAL_BOXES - done;

  const total = BOARD_CONFIG.TOTAL_BOXES;
  progP1.style.width = `${(s1/total)*100}%`;
  progP2.style.width = `${(s2/total)*100}%`;

  const curr = state.game.currentPlayer;
  if (curr === PLAYERS.PLAYER_1) {
    p1Card.classList.add('active');   p2Card.classList.remove('active');
    turnInd.className = 'turn-ind p1-ind';
    turnText.textContent = `${p1Name.textContent}'s turn`;
  } else {
    p2Card.classList.add('active');   p1Card.classList.remove('active');
    turnInd.className = 'turn-ind p2-ind';
    turnText.textContent = `${p2Name.textContent}'s turn`;
  }

  btnUndo.disabled = state.game.moveHistory.length === 0 || state.isAiThinking;
}

/* ═══════════════════════════════════════════════════════════════════════════
   BANNER
═══════════════════════════════════════════════════════════════════════════ */
function showBanner(msg, player, type = '') {
  if (state.bannerTo) clearTimeout(state.bannerTo);
  bannerTxt.textContent = msg;
  const cls = type === 'neutral' ? 'neutral' : `p${player}-banner`;
  banner.className = `banner show ${cls}`;
  state.bannerTo = setTimeout(() => banner.classList.remove('show'), 1400);
}
function clearBanner() {
  if (state.bannerTo) clearTimeout(state.bannerTo);
  banner.className = 'banner hidden';
}

/* ═══════════════════════════════════════════════════════════════════════════
   MATCH END
═══════════════════════════════════════════════════════════════════════════ */
function resolveMatchEnd(winner) {
  // Record stats
  if (state.p1User) {
    if (winner === 'DRAW') {
      auth.recordMatch(state.p1User.uid, 'draw');
    } else if (winner === 1) {
      auth.recordMatch(state.p1User.uid, (state.mode === 'online' && state.myOnlineIndex === 2) ? 'loss' : 'win');
    } else {
      auth.recordMatch(state.p1User.uid, (state.mode === 'online' && state.myOnlineIndex === 1) ? 'loss' : 'win');
    }
  }

  goP1Name.textContent  = p1Name.textContent;
  goP2Name.textContent  = p2Name.textContent;
  goP1Score.textContent = state.game.scores[1];
  goP2Score.textContent = state.game.scores[2];

  if (winner === 'DRAW') {
    goTrophy.textContent = '🤝';
    goTitle.textContent  = "It's a Draw!";
    goTitle.style.color  = 'var(--silver-2)';
    goSub.textContent    = 'Both players scored equally.';
  } else {
    const wName = winner === 1 ? p1Name.textContent : p2Name.textContent;
    const wCol  = winner === 1 ? 'var(--p1)' : 'var(--p2)';
    goTrophy.textContent = '◆';
    goTitle.textContent  = `${wName} wins`;
    goTitle.style.color  = wCol;
    goSub.textContent    = `${winner === 1 ? state.game.scores[1] : state.game.scores[2]} boxes out of 49`;
  }
  modalGameover.classList.add('active');
}

function showDisconnectWin(myIdx) {
  const wName = myIdx === 1 ? p1Name.textContent : p2Name.textContent;
  if (state.p1User) auth.recordMatch(state.p1User.uid, 'win');
  goTrophy.textContent = '◆';
  goTitle.textContent  = `${wName} wins`;
  goTitle.style.color  = myIdx === 1 ? 'var(--p1)' : 'var(--p2)';
  goSub.textContent    = 'Opponent disconnected.';
  goP1Name.textContent  = p1Name.textContent;
  goP2Name.textContent  = p2Name.textContent;
  goP1Score.textContent = state.game.scores[1];
  goP2Score.textContent = state.game.scores[2];
  modalGameover.classList.add('active');
}

/* ═══════════════════════════════════════════════════════════════════════════
   IN-GAME CONTROLS
═══════════════════════════════════════════════════════════════════════════ */
btnNewGame.addEventListener('click', () => {
  modalGameover.classList.remove('active');
  resetGameState();
});
btnPlayAgain.addEventListener('click', () => {
  modalGameover.classList.remove('active');
  resetGameState();
});
btnGoHome.addEventListener('click', () => {
  modalGameover.classList.remove('active');
  exitToHome();
});
btnMute.addEventListener('click', () => {
  const m = sound.toggleMute?.();
  btnMute.textContent = m ? '♪̶' : '♪';
});

btnExitGame.addEventListener('click', () => {
  if (state.mode === 'online' && !state.game.isGameOver) {
    modalExit.classList.add('active');
  } else {
    exitToHome();
  }
});
btnConfirmExit.addEventListener('click', () => {
  modalExit.classList.remove('active');
  if (onlineEngine?.isConnected()) { onlineEngine.disconnect(); onlineEngine = null; }
  if (state.p1User) auth.recordMatch(state.p1User.uid, 'loss');
  exitToHome();
});
btnCancelExit.addEventListener('click', () => modalExit.classList.remove('active'));

btnUndo.addEventListener('click', () => {
  if (state.game.moveHistory.length === 0 || state.isAiThinking) return;

  // Collect history, undo, replay
  const savedHistory = [...state.game.moveHistory];

  // In AI mode, pop until we get back to P1's last turn
  let pops = 1;
  if ((state.mode === 'ai_easy' || state.mode === 'ai_smart')) {
    // pop last 2 moves (AI move + player move)
    pops = Math.min(2, savedHistory.length);
  }

  const remaining = savedHistory.slice(0, savedHistory.length - pops);

  // Full reset then replay
  state.game.reset();
  buildBoard();

  remaining.forEach(mv => {
    const res = state.game.makeMove(mv.type, mv.row, mv.col);
    const lineEl = $(`${mv.type}-line-${mv.row}-${mv.col}`);
    if (lineEl) lineEl.classList.add('drawn', `player-${mv.player}`);
    if (res.completedBoxes?.length) {
      const initials = mv.player === 1 ? p1Avatar.textContent : p2Avatar.textContent;
      res.completedBoxes.forEach(({ row: r, col: c }) => {
        const bx = $(`box-${r}-${c}`);
        if (bx) {
          bx.classList.add('claimed', `player-${mv.player}`);
          const t = bx.querySelector('.box-label');
          if (t) t.textContent = initials;
        }
      });
    }
  });

  updateHUD();
  turnTimer.start();
});

function exitToHome() {
  turnTimer.stop();
  clearBanner();
  modalGameover.classList.remove('active');
  modalExit.classList.remove('active');
  if (onlineEngine) { onlineEngine.disconnect(); onlineEngine = null; }
  refreshLeaderboard();
  enterHome();
}

/* ═══════════════════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  await auth.init();

  // Clear ALL old user data as requested
  // (Wipe old localStorage keys from previous version)
  ['dots_boxes_users_json', 'dots_boxes_current_user'].forEach(k => {
    try { localStorage.removeItem(k); } catch {}
  });

  // Restore session if user was previously logged in under new schema
  const saved = auth.getCurrentUser();
  if (saved) {
    state.p1User = saved;
    enterHome();
  } else {
    showScreen(S_AUTH);
  }
});
