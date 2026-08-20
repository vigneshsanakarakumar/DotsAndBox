import { BOARD_CONFIG }             from './constants.js';
import { DotsAndBoxesGame, PLAYER_COLORS } from './gameLogic.js';
import { DotsAndBoxesAI }           from './ai.js';
import { sound }                    from './audio.js';
import { auth }                     from './auth.js';
import { TurnTimer }                from './timer.js';
import { OnlineMultiplayerEngine }  from './online.js';

/* ═══════════════════════════════════════════════════════════════════════════
   GAME STATE
═══════════════════════════════════════════════════════════════════════════ */
const state = {
  mode:          null,   // 'offline' | 'online' | 'ai_easy' | 'ai_smart'
  playerCount:   2,
  myOnlineIndex: 1,
  p1User:        null,
  pendingFbUser: null,
  game:          new DotsAndBoxesGame(2),
  players: {
    1: { username: 'Player 1', isMe: true  },
    2: { username: 'Player 2', isMe: false },
    3: { username: 'Player 3', isMe: false },
    4: { username: 'Player 4', isMe: false },
  },
  isAiThinking:   false,
  bannerTo:       null,
  gameStartTime:  null,    // for match duration stat
  totalMoves:     0,
  newGamePending: false,   // confirmation flow
};

let onlineEngine     = null;
let selectedRoomSize = 2;

/* ═══════════════════════════════════════════════════════════════════════════
   DOM
═══════════════════════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);

const S_AUTH  = $('screen-auth');
const S_HOME  = $('screen-home');
const S_LOBBY = $('screen-lobby');
const S_GAME  = $('screen-game');
const ALL_SCREENS = [S_AUTH, S_HOME, S_LOBBY, S_GAME];

function showScreen(el) {
  ALL_SCREENS.forEach(s => s.classList.remove('active'));
  el.classList.add('active');
}

/* Auth */
const stepMethod     = $('auth-step-method');
const stepUsername   = $('auth-step-username');
const segSignin      = $('seg-signin');
const segSignup      = $('seg-signup');
const formSignin     = $('form-signin');
const formSignup     = $('form-signup');
const btnGoogle      = $('btn-google-signin');
const siEmail        = $('si-email');
const siPassword     = $('si-password');
const siError        = $('si-error');
const btnSigninEmail = $('btn-signin-email');
const suEmail        = $('su-email');
const suPassword     = $('su-password');
const suError        = $('su-error');
const btnSignupEmail = $('btn-signup-email');
const authErrGlobal  = $('auth-error-global');
const previewPhoto   = $('preview-photo');
const previewEmail   = $('preview-email');
const usernameInput  = $('username-input');
const usernameHint   = $('username-hint');
const usernameError  = $('username-error');
const btnSetUsername = $('btn-set-username');
const btnSignoutBack = $('btn-signout-back');

/* Home */
const hcName         = $('hc-name');
const btnHomeSignout = $('btn-home-signout');
const lbList         = $('lb-list');

/* Lobby */
const lobbyOffline    = $('lobby-offline');
const lobbyOnline     = $('lobby-online');
const p2NameInput     = $('p2-name-input');
const p2NameHint      = $('p2-name-hint');
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

/* Game */
const btnExitGame   = $('btn-exit-game');
const btnMute       = $('btn-mute');
const btnUndo       = $('btn-undo');
const btnNewGame    = $('btn-new-game');
const timerCard     = $('timer-card');
const timerNum      = $('timer-num');
const timerBar      = $('timer-bar');
const turnInd       = $('turn-indicator');
const turnText      = $('turn-text');
const boxesDone     = $('boxes-done');
const boxesLeft     = $('boxes-left');
const progP1        = $('prog-p1');
const progP2        = $('prog-p2');
const boardSvg      = $('board-svg');
const banner        = $('game-banner');
const bannerTxt     = $('banner-txt');

/* Per-seat card refs [1–4] */
const SEAT = {};
for (let p = 1; p <= 4; p++) {
  SEAT[p] = {
    card:    $(`p${p}-card`),
    name:    $(`p${p}-name`),
    avatar:  $(`p${p}-avatar`),
    score:   $(`p${p}-score`),
    turnTag: $(`p${p}-turn-tag`),   // see HTML — we add ids below
  };
}

/* Modals */
const modalGameover    = $('modal-gameover');
const modalExit        = $('modal-exit');
const modalNewGame     = $('modal-newgame');
const goTrophy         = $('go-trophy');
const goTitle          = $('go-title');
const goSub            = $('go-sub');
const goP1Name         = $('go-p1-name');
const goP2Name         = $('go-p2-name');
const goP1Score        = $('go-p1-score');
const goP2Score        = $('go-p2-score');
const goStats          = $('go-stats');
const btnPlayAgain     = $('btn-play-again');
const btnGoHome        = $('btn-go-home');
const btnConfirmExit   = $('btn-confirm-exit');
const btnCancelExit    = $('btn-cancel-exit');
const btnConfirmNew    = $('btn-confirm-new');
const btnCancelNew     = $('btn-cancel-new');

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════════════ */
function setHint(el, msg, cls = '') {
  if (!el) return;
  el.textContent = msg;
  el.className = `field-hint${cls ? ' ' + cls : ''}`;
}
function showErr(el, msg) { if (!el) return; el.textContent = msg; el.classList.remove('hidden'); }
function hideErr(el)      { if (!el) return; el.classList.add('hidden'); el.textContent = ''; }
function abbrev(name, max = 12) { return name?.length > max ? name.slice(0, max - 1) + '…' : (name || '?'); }
function initials(name)  { return (name || 'P1').slice(0, 2).toUpperCase(); }
function fmtDuration(ms) {
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TURN TIMER
═══════════════════════════════════════════════════════════════════════════ */
const turnTimer = new TurnTimer({
  duration: 20,
  warningThreshold: 5,
  onTick(s, pct) {
    if (timerNum) timerNum.textContent = s;
    if (timerBar) timerBar.style.width = `${pct}%`;
    if (timerCard) timerCard.className = s <= 5 ? 'timer-card danger'
                                       : s <= 10 ? 'timer-card warning'
                                       : 'timer-card normal';
  },
  onWarning() { sound.playTimerTick?.(); },
  onTimeout: handleTurnTimeout,
});

/* Pause timer when page is hidden (tab switch / minimise) */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) turnTimer.pause();
  else turnTimer.resume();
});

/* ═══════════════════════════════════════════════════════════════════════════
   SEAT COLORS — fixed per seat number, applied once before game starts
═══════════════════════════════════════════════════════════════════════════ */
function applySeatColors(playerCount) {
  const root = document.documentElement;
  for (let p = 1; p <= 4; p++) {
    const c = PLAYER_COLORS[p];
    root.style.setProperty(`--p${p}`,     c.solid);
    root.style.setProperty(`--p${p}-dim`, c.dim);
    root.style.setProperty(`--p${p}-bd`,  c.border);
  }
  // Show/hide P3 & P4 score cards
  for (let p = 3; p <= 4; p++) {
    SEAT[p].card?.classList.toggle('hidden', p > playerCount);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   ONLINE ENGINE
═══════════════════════════════════════════════════════════════════════════ */
function createOnlineEngine() {
  if (onlineEngine) { onlineEngine.disconnect(); onlineEngine = null; }
  onlineEngine = new OnlineMultiplayerEngine({
    onStatusChange(status, msg) {
      if (rcStatusText) rcStatusText.textContent = msg;
      if (joinStatus)   joinStatus.textContent   = msg;
    },
    onRoomReady(code) {
      if (rcValue)    rcValue.textContent = code;
      if (roomCodeBox) roomCodeBox.classList.remove('hidden');
    },
    onPlayerListUpdated(list) {
      list.forEach(entry => {
        const idx = entry?.playerIndex;
        if (!idx) return;
        if (entry.profile?.username)
          state.players[idx] = { username: entry.profile.username, isMe: idx === state.myOnlineIndex };
      });
    },
    onGameStart({ players, myIndex }) {
      state.myOnlineIndex = myIndex;
      state.playerCount   = players.length;
      state.game.reset(players.length);
      players.forEach(entry => {
        const idx  = entry?.playerIndex;
        const name = entry?.profile?.username || `Player ${idx}`;
        if (idx) state.players[idx] = { username: name, isMe: idx === myIndex };
      });
      initGameScreen();
    },
    onMoveReceived(move) { processMove(move.type, move.row, move.col, false); },
    onTimeoutReceived(skipped) { handleTurnTimeout(true, skipped); },
    onRestartReceived() { resetGameState(); },
    onPlayerJoined() {},
    onDisconnected() {
      if (state.game.isGameOver) return;
      turnTimer.stop();
      showDisconnectWin(state.myOnlineIndex);
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════════════════════ */
segSignin?.addEventListener('click', () => {
  segSignin.classList.add('active');    segSignup?.classList.remove('active');
  formSignin?.classList.add('active');  formSignup?.classList.remove('active');
  hideErr(siError); hideErr(suError);
});
segSignup?.addEventListener('click', () => {
  segSignup.classList.add('active');    segSignin?.classList.remove('active');
  formSignup?.classList.add('active');  formSignin?.classList.remove('active');
  hideErr(siError); hideErr(suError);
});

btnGoogle?.addEventListener('click', async () => {
  hideErr(authErrGlobal);
  btnGoogle.disabled = true; btnGoogle.textContent = 'Signing in…';
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

btnSigninEmail?.addEventListener('click', async () => {
  hideErr(siError);
  const email = siEmail?.value.trim(), pass = siPassword?.value;
  if (!email || !pass) { showErr(siError, 'Enter email and password.'); return; }
  btnSigninEmail.disabled = true; btnSigninEmail.textContent = 'Signing in…';
  try { const u = await auth.signInWithEmail(email, pass); await afterFirebaseAuth(u); }
  catch (e) { showErr(siError, e.message); }
  finally { btnSigninEmail.disabled = false; btnSigninEmail.textContent = 'Sign In →'; }
});

btnSignupEmail?.addEventListener('click', async () => {
  hideErr(suError);
  const email = suEmail?.value.trim(), pass = suPassword?.value;
  if (!email) { showErr(suError, 'Enter your email.'); return; }
  if (!pass || pass.length < 6) { showErr(suError, 'Password must be ≥ 6 chars.'); return; }
  btnSignupEmail.disabled = true; btnSignupEmail.textContent = 'Creating…';
  try { const u = await auth.signUpWithEmail(email, pass); await afterFirebaseAuth(u); }
  catch (e) { showErr(suError, e.message); }
  finally { btnSignupEmail.disabled = false; btnSignupEmail.textContent = 'Create Account →'; }
});

async function afterFirebaseAuth(fbUser) {
  hideErr(authErrGlobal);
  const existing = auth.getProfileByUid(fbUser.uid);
  if (existing) {
    const r = auth.setUsername(fbUser.uid, existing.username, fbUser.email, fbUser.photo);
    if (r.success) { state.p1User = r.user; enterHome(); return; }
  }
  state.pendingFbUser = fbUser;
  const suggested = fbUser.displayName?.replace(/\s+/g, '').slice(0, 16) || '';
  if (usernameInput) usernameInput.value = suggested;
  if (previewEmail)  previewEmail.textContent = fbUser.email || fbUser.uid;
  if (previewPhoto)  previewPhoto.textContent = fbUser.photo ? '' : (fbUser.email || '?')[0].toUpperCase();
  if (fbUser.photo && previewPhoto) {
    const img = document.createElement('img');
    img.src = fbUser.photo; img.style.cssText = 'width:28px;height:28px;border-radius:50%;object-fit:cover;';
    previewPhoto.innerHTML = ''; previewPhoto.appendChild(img);
  }
  if (suggested) checkUsernameAvailability(suggested);
  stepMethod?.classList.remove('active');
  stepUsername?.classList.add('active');
}

usernameInput?.addEventListener('input', () => {
  const v = usernameInput.value.trim();
  if (!v) { setHint(usernameHint, ''); usernameInput.classList.remove('err','ok'); return; }
  checkUsernameAvailability(v);
});

function checkUsernameAvailability(name) {
  if (name.length < 2) {
    setHint(usernameHint, 'Too short (min 2 chars).', 'err');
    usernameInput?.classList.add('err'); usernameInput?.classList.remove('ok'); return false;
  }
  const taken = auth.isUsernameTaken(name, state.pendingFbUser?.uid);
  if (taken) {
    setHint(usernameHint, `"${name}" is taken — try another.`, 'err');
    usernameInput?.classList.add('err'); usernameInput?.classList.remove('ok'); return false;
  }
  setHint(usernameHint, '✓ Available', 'ok');
  usernameInput?.classList.remove('err'); usernameInput?.classList.add('ok'); return true;
}

btnSetUsername?.addEventListener('click', () => {
  hideErr(usernameError);
  const name = usernameInput?.value.trim() || '';
  if (!checkUsernameAvailability(name)) { showErr(usernameError, usernameHint?.textContent); return; }
  const fb = state.pendingFbUser; if (!fb) return;
  const r = auth.setUsername(fb.uid, name, fb.email, fb.photo);
  if (!r.success) { showErr(usernameError, r.error); return; }
  state.p1User = r.user; state.pendingFbUser = null; enterHome();
});

btnSignoutBack?.addEventListener('click', () => {
  state.pendingFbUser = null;
  stepUsername?.classList.remove('active'); stepMethod?.classList.add('active'); hideErr(usernameError);
});

/* ═══════════════════════════════════════════════════════════════════════════
   HOME
═══════════════════════════════════════════════════════════════════════════ */
function enterHome() {
  if (hcName) hcName.textContent = state.p1User?.username || 'Player';
  refreshLeaderboard();
  showScreen(S_HOME);
}

function refreshLeaderboard() {
  const users = auth.getAllUsers();
  if (!users.length) { if (lbList) lbList.innerHTML = '<p class="lb-empty">No matches yet.</p>'; return; }
  if (lbList) lbList.innerHTML = users.slice(0, 8).map((u, i) => `
    <div class="lb-row">
      <span class="lb-rank">#${i+1}</span>
      <span class="lb-name">${u.username}</span>
      <span class="lb-wins">${u.wins}W</span>
      <span class="lb-games">${u.gamesPlayed}m</span>
    </div>`).join('');
}

btnHomeSignout?.addEventListener('click', () => {
  auth.logout(); state.p1User = null;
  stepUsername?.classList.remove('active'); stepMethod?.classList.add('active');
  if (siEmail)    siEmail.value = '';
  if (siPassword) siPassword.value = '';
  hideErr(siError); hideErr(authErrGlobal);
  showScreen(S_AUTH);
});

document.querySelectorAll('.mode-tile').forEach(tile => {
  tile.addEventListener('click', () => {
    state.mode = tile.dataset.mode;
    if (state.mode === 'offline')     { showLobbyPanel('offline'); showScreen(S_LOBBY); }
    else if (state.mode === 'online') { showLobbyPanel('online');  showScreen(S_LOBBY); }
    else { state.playerCount = 2; startLocalGame(); }
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   LOBBY
═══════════════════════════════════════════════════════════════════════════ */
function showLobbyPanel(which) {
  lobbyOffline?.classList.toggle('hidden', which !== 'offline');
  lobbyOnline?.classList.toggle('hidden',  which !== 'online');
}

btnOfflineBack?.addEventListener('click', () => showScreen(S_HOME));

p2NameInput?.addEventListener('input', () => {
  const v = p2NameInput.value.trim();
  if (!v) { setHint(p2NameHint, ''); p2NameInput.classList.remove('err','ok'); return; }
  if (v.toLowerCase() === state.p1User?.username?.toLowerCase()) {
    setHint(p2NameHint, 'Must differ from your name.', 'err');
    p2NameInput.classList.add('err'); p2NameInput.classList.remove('ok');
  } else if (v.length < 2) {
    setHint(p2NameHint, 'Too short.', 'err');
    p2NameInput.classList.add('err'); p2NameInput.classList.remove('ok');
  } else {
    setHint(p2NameHint, '✓ Good', 'ok');
    p2NameInput.classList.remove('err'); p2NameInput.classList.add('ok');
  }
});

btnOfflineStart?.addEventListener('click', () => {
  const name = p2NameInput?.value.trim() || '';
  if (name.length < 2) { setHint(p2NameHint, 'Enter a name (≥2 chars).', 'err'); return; }
  if (name.toLowerCase() === state.p1User?.username?.toLowerCase()) {
    setHint(p2NameHint, 'Player 2 needs a different name.', 'err'); return;
  }
  state.playerCount = 2;
  state.players[1] = { username: state.p1User?.username || 'Player 1', isMe: true };
  state.players[2] = { username: name, isMe: false };
  startLocalGame();
});

/* Room size tabs */
document.querySelectorAll('.size-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.size-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    selectedRoomSize = parseInt(tab.dataset.size, 10);
  });
});

/* Online room code validation */
function validateRoomCode(code) {
  if (!code)               return 'Enter a room code.';
  if (!/^BOX-\d{4}$/.test(code)) return 'Invalid format. Expected BOX-XXXX (e.g. BOX-1234).';
  return null;
}

btnOnlineBack?.addEventListener('click', () => {
  if (onlineEngine) { onlineEngine.disconnect(); onlineEngine = null; }
  showScreen(S_HOME);
});

btnCreateRoom?.addEventListener('click', async () => {
  createOnlineEngine();
  if (roomCodeBox) roomCodeBox.classList.add('hidden');
  btnCreateRoom.disabled = true; btnCreateRoom.textContent = 'Setting up…';
  state.myOnlineIndex = 1;
  state.playerCount   = selectedRoomSize;
  state.players[1]    = { username: state.p1User?.username || 'Player 1', isMe: true };
  await onlineEngine.createRoom(state.p1User, selectedRoomSize);
  btnCreateRoom.disabled = false; btnCreateRoom.textContent = '+ Create Room';
});

btnJoinRoom?.addEventListener('click', async () => {
  const raw  = joinCodeInput?.value.trim().toUpperCase() || '';
  const err  = validateRoomCode(raw);
  if (err) { if (joinStatus) joinStatus.textContent = err; return; }
  createOnlineEngine();
  if (joinStatus) joinStatus.textContent = 'Connecting…';
  await onlineEngine.joinRoom(raw, state.p1User);
});

btnCopyCode?.addEventListener('click', () => {
  const code = rcValue?.textContent || '';
  navigator.clipboard.writeText(code).then(() => {
    if (btnCopyCode) { btnCopyCode.textContent = 'copied!'; setTimeout(() => { btnCopyCode.textContent = 'copy'; }, 2000); }
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   GAME START
═══════════════════════════════════════════════════════════════════════════ */
function startLocalGame() {
  if (state.mode === 'ai_easy')  state.players[2] = { username: 'AI Casual', isMe: false };
  else if (state.mode === 'ai_smart') state.players[2] = { username: 'AI Smart',  isMe: false };
  applySeatColors(state.playerCount);
  refreshSeatNames();
  if (btnUndo) btnUndo.style.display = 'inline-flex';
  resetGameState();
  showScreen(S_GAME);
}

function initGameScreen() {
  applySeatColors(state.playerCount);
  refreshSeatNames();
  if (btnUndo) btnUndo.style.display = 'none';
  resetGameState();
  showScreen(S_GAME);
}

function refreshSeatNames() {
  for (let p = 1; p <= 4; p++) {
    if (SEAT[p].name)   SEAT[p].name.textContent   = abbrev(state.players[p]?.username || `P${p}`);
    if (SEAT[p].avatar) SEAT[p].avatar.textContent = initials(state.players[p]?.username || `P${p}`);
  }
}

function resetGameState() {
  state.game.reset(state.playerCount);
  state.isAiThinking = false;
  state.totalMoves   = 0;
  state.gameStartTime = Date.now();
  clearBanner();
  // Ensure modal is closed on reset
  if (modalGameover) modalGameover.classList.remove('active');
  buildBoard();
  updateHUD();
  turnTimer.start();
}

/* ═══════════════════════════════════════════════════════════════════════════
   BOARD SVG
═══════════════════════════════════════════════════════════════════════════ */
function buildBoard() {
  const BOX = 60, PAD = 32;
  const ROWS = BOARD_CONFIG.DOT_ROWS, COLS = BOARD_CONFIG.DOT_COLS;
  const ns = 'http://www.w3.org/2000/svg';
  boardSvg.setAttribute('viewBox', `0 0 ${PAD*2+(COLS-1)*BOX} ${PAD*2+(ROWS-1)*BOX}`);
  boardSvg.innerHTML = '';

  const mk = (tag, attrs) => {
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };

  // Boxes
  const gB = mk('g', {});
  for (let r = 0; r < BOARD_CONFIG.BOX_ROWS; r++)
    for (let c = 0; c < BOARD_CONFIG.BOX_COLS; c++) {
      const x = PAD + c*BOX, y = PAD + r*BOX;
      const g = mk('g', { class:'box-item', id:`box-${r}-${c}` });
      g.appendChild(mk('rect', { x, y, width:BOX, height:BOX, rx:4, ry:4, class:'box-rect' }));
      const t = mk('text', { x:x+BOX/2, y:y+BOX/2+5, 'text-anchor':'middle', class:'box-label' });
      t.textContent = ''; g.appendChild(t); gB.appendChild(g);
    }
  boardSvg.appendChild(gB);

  // Lines
  const gL = mk('g', {});
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < BOARD_CONFIG.BOX_COLS; c++) {
      const x1 = PAD+c*BOX, y = PAD+r*BOX, x2 = x1+BOX;
      const g = mk('g', { class:'line-group', id:`h-line-${r}-${c}` });
      g.appendChild(mk('line', { x1, y1:y, x2, y2:y, class:'grid-line' }));
      g.appendChild(mk('line', { x1, y1:y, x2, y2:y, class:'line-hitarea' }));
      g.addEventListener('click', () => onLineClick('h', r, c));
      gL.appendChild(g);
    }
  for (let r = 0; r < BOARD_CONFIG.BOX_ROWS; r++)
    for (let c = 0; c < BOARD_CONFIG.DOT_COLS; c++) {
      const x = PAD+c*BOX, y1 = PAD+r*BOX, y2 = y1+BOX;
      const g = mk('g', { class:'line-group', id:`v-line-${r}-${c}` });
      g.appendChild(mk('line', { x1:x, y1, x2:x, y2, class:'grid-line' }));
      g.appendChild(mk('line', { x1:x, y1, x2:x, y2, class:'line-hitarea' }));
      g.addEventListener('click', () => onLineClick('v', r, c));
      gL.appendChild(g);
    }
  boardSvg.appendChild(gL);

  // Dots
  const gD = mk('g', {});
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      gD.appendChild(mk('circle', { cx:PAD+c*BOX, cy:PAD+r*BOX, r:5, class:'grid-dot' }));
  boardSvg.appendChild(gD);
}

/* ═══════════════════════════════════════════════════════════════════════════
   MOVE PROCESSING
═══════════════════════════════════════════════════════════════════════════ */
function onLineClick(type, row, col) {
  if (state.game.isGameOver || state.isAiThinking) return;
  const curr = state.game.currentPlayer;
  if (state.mode === 'online' && curr !== state.myOnlineIndex) return;
  if ((state.mode === 'ai_easy' || state.mode === 'ai_smart') && curr !== 1) return;

  const res = processMove(type, row, col, true);
  if (res?.success && state.mode === 'online' && onlineEngine) {
    onlineEngine.sendMove(type, row, col);
  }
}

function processMove(type, row, col, isLocal) {
  const result = state.game.makeMove(type, row, col);
  if (!result.success) return result;

  state.totalMoves++;
  const player = result.move.player;
  sound.playLineClick?.();

  const lineEl = $(`${type}-line-${row}-${col}`);
  if (lineEl) {
    lineEl.classList.add('drawn', `player-${player}`, 'just-drawn');
    setTimeout(() => lineEl.classList.remove('just-drawn'), 350);
  }

  if (result.completedBoxes.length > 0) {
    sound.playBoxComplete?.(result.completedBoxes.length > 1);
    const av = initials(state.players[player]?.username || `P${player}`);
    result.completedBoxes.forEach(({ row: r, col: c }) => {
      const bx = $(`box-${r}-${c}`);
      if (bx) {
        bx.classList.add('claimed', `player-${player}`);
        const t = bx.querySelector('.box-label');
        if (t) t.textContent = av;
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
    setTimeout(() => resolveMatchEnd(result.winner), 400);
    return result;
  }

  turnTimer.start();
  updateHUD();

  if ((state.mode === 'ai_easy' || state.mode === 'ai_smart') && state.game.currentPlayer !== 1) {
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
   TURN TIMEOUT  (fixed: lock prevents double-fire, N-player cycle works)
═══════════════════════════════════════════════════════════════════════════ */
function handleTurnTimeout(fromRemote = false, remoteSkipped = null) {
  if (state.game.isGameOver) return;

  const result = state.game.handleTimeout();
  if (!result.success) return;

  sound.playTimeout?.();
  const name = abbrev(state.players[result.skippedPlayer]?.username || `P${result.skippedPlayer}`);
  showBanner(`${name} timed out — turn skipped`, result.skippedPlayer, 'neutral');

  if (!fromRemote && state.mode === 'online' && onlineEngine) {
    onlineEngine.sendTimeout(result.skippedPlayer);
  }

  updateHUD();
  turnTimer.start();

  if ((state.mode === 'ai_easy' || state.mode === 'ai_smart') && state.game.currentPlayer !== 1) {
    scheduleAI();
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   HUD UPDATE  ← SINGLE SOURCE OF TRUTH for all turn UI
   Bug fix: sc-turn-tag text updated per seat; inactive seats get "Waiting"
═══════════════════════════════════════════════════════════════════════════ */
function updateHUD() {
  const done  = state.game.completedBoxes;
  const total = BOARD_CONFIG.TOTAL_BOXES;
  const curr  = state.game.currentPlayer;

  if (boxesDone) boxesDone.textContent = done;
  if (boxesLeft) boxesLeft.textContent = total - done;

  for (let p = 1; p <= state.playerCount; p++) {
    const s    = state.game.scores[p] || 0;
    const isActive = p === curr;
    const isMe     = state.mode !== 'online' || p === state.myOnlineIndex;

    SEAT[p].score.textContent = s;
    SEAT[p].card.classList.toggle('active', isActive);

    // ── Turn tag text — only ONE card shows "YOUR TURN" ──
    const tag = SEAT[p].card.querySelector('.sc-turn-tag');
    if (tag) {
      if (isActive) {
        tag.textContent = isMe ? 'YOUR TURN' : 'THEIR TURN';
        tag.style.display = 'block';
      } else {
        tag.textContent   = 'WAITING';
        tag.style.display = 'block';
        tag.style.color   = 'var(--silver-4)';
      }
    }
  }

  if (progP1) progP1.style.width = `${((state.game.scores[1]||0)/total)*100}%`;
  if (progP2) progP2.style.width = `${((state.game.scores[2]||0)/total)*100}%`;

  const currName = abbrev(state.players[curr]?.username || `P${curr}`);
  const isMyTurn = state.mode !== 'online' || curr === state.myOnlineIndex;
  if (turnInd) turnInd.className = `turn-ind p${curr}-ind`;
  if (turnText) turnText.textContent = isMyTurn ? `Your turn (${currName})` : `${currName}'s turn`;

  if (btnUndo) btnUndo.disabled = state.game.moveHistory.length === 0 || state.isAiThinking;
}

/* ═══════════════════════════════════════════════════════════════════════════
   BANNER
═══════════════════════════════════════════════════════════════════════════ */
function showBanner(msg, player, type = '') {
  if (state.bannerTo) clearTimeout(state.bannerTo);
  if (bannerTxt) bannerTxt.textContent = msg;
  const cls = type === 'neutral' ? 'neutral' : `p${player}-banner`;
  if (banner) banner.className = `banner show ${cls}`;
  state.bannerTo = setTimeout(() => {
    banner?.classList.remove('show');
    setTimeout(() => { if (banner) banner.className = 'banner hidden'; }, 250);
  }, 1400);
}
function clearBanner() {
  if (state.bannerTo) clearTimeout(state.bannerTo);
  if (banner) banner.className = 'banner hidden';
}

/* ═══════════════════════════════════════════════════════════════════════════
   MATCH END  — real name + stats in winner screen
═══════════════════════════════════════════════════════════════════════════ */
function resolveMatchEnd(winner) {
  // Pause timer (shouldn't be running but safety)
  turnTimer.stop();

  // Record user stats
  if (state.p1User) {
    let outcome = 'loss';
    if (winner === 'DRAW') outcome = 'draw';
    else if (state.mode === 'online') outcome = winner === state.myOnlineIndex ? 'win' : 'loss';
    else outcome = winner === 1 ? 'win' : 'loss';
    auth.recordMatch(state.p1User.uid, outcome);
  }

  const duration = fmtDuration(Date.now() - (state.gameStartTime || Date.now()));

  // Winner display
  if (winner === 'DRAW') {
    if (goTrophy) goTrophy.textContent = '🤝';
    if (goTitle)  { goTitle.textContent = "It's a Draw!"; goTitle.style.color = 'var(--silver-2)'; }
    if (goSub)    goSub.textContent = 'Both players scored equally.';
  } else {
    const wName = abbrev(state.players[winner]?.username || `P${winner}`, 16);
    const wScore = state.game.scores[winner] || 0;
    const oScore = Object.values(state.game.scores).sort((a,b)=>b-a).find(s => s !== wScore) ?? 0;
    if (goTrophy) goTrophy.textContent = '🏆';
    if (goTitle)  { goTitle.textContent = `${wName} Wins!`; goTitle.style.color = `var(--p${winner})`; }
    if (goSub)    goSub.textContent     = `Score: ${wScore} – ${oScore}`;
  }

  // Score breakdown
  if (goP1Name)  goP1Name.textContent  = abbrev(state.players[1]?.username || 'P1', 10);
  if (goP2Name)  goP2Name.textContent  = abbrev(state.players[2]?.username || 'P2', 10);
  if (goP1Score) goP1Score.textContent = state.game.scores[1] || 0;
  if (goP2Score) goP2Score.textContent = state.game.scores[2] || 0;

  // Match stats
  if (goStats) {
    goStats.innerHTML = `
      <div class="stat-row"><span>Total moves</span><strong>${state.totalMoves}</strong></div>
      <div class="stat-row"><span>Boxes claimed</span><strong>${state.game.completedBoxes}/49</strong></div>
      <div class="stat-row"><span>Duration</span><strong>${duration}</strong></div>
    `;
  }

  if (modalGameover) modalGameover.classList.add('active');
}

function showDisconnectWin(myIdx) {
  if (state.p1User) auth.recordMatch(state.p1User.uid, 'win');
  turnTimer.stop();
  const wName = abbrev(state.players[myIdx]?.username || `P${myIdx}`, 16);
  if (goTrophy)  goTrophy.textContent = '🏆';
  if (goTitle)   { goTitle.textContent = `${wName} Wins!`; goTitle.style.color = `var(--p${myIdx})`; }
  if (goSub)     goSub.textContent    = 'Opponent disconnected.';
  if (goP1Name)  goP1Name.textContent  = abbrev(state.players[1]?.username || 'P1', 10);
  if (goP2Name)  goP2Name.textContent  = abbrev(state.players[2]?.username || 'P2', 10);
  if (goP1Score) goP1Score.textContent = state.game.scores[1] || 0;
  if (goP2Score) goP2Score.textContent = state.game.scores[2] || 0;
  if (goStats)   goStats.innerHTML = '';
  if (modalGameover) modalGameover.classList.add('active');
}

/* ═══════════════════════════════════════════════════════════════════════════
   IN-GAME CONTROLS
═══════════════════════════════════════════════════════════════════════════ */
btnPlayAgain?.addEventListener('click', () => {
  modalGameover?.classList.remove('active');
  resetGameState();
});
btnGoHome?.addEventListener('click', () => {
  modalGameover?.classList.remove('active');
  exitToHome();
});
btnMute?.addEventListener('click', () => {
  const m = sound.toggleMute?.();
  if (btnMute) btnMute.textContent = m ? '♪̶' : '♪';
});

/* Exit game */
btnExitGame?.addEventListener('click', () => {
  if (state.mode === 'online' && !state.game.isGameOver) modalExit?.classList.add('active');
  else exitToHome();
});
btnConfirmExit?.addEventListener('click', () => {
  modalExit?.classList.remove('active');
  if (onlineEngine?.isConnected()) { onlineEngine.disconnect(); onlineEngine = null; }
  if (state.p1User) auth.recordMatch(state.p1User.uid, 'loss');
  exitToHome();
});
btnCancelExit?.addEventListener('click', () => modalExit?.classList.remove('active'));

/* New Game — requires confirmation so you can't accidentally lose progress */
btnNewGame?.addEventListener('click', () => {
  if (state.game.moveHistory.length === 0) { resetGameState(); return; } // no moves yet = no confirm needed
  modalNewGame?.classList.add('active');
  turnTimer.pause();   // pause timer while modal is open
});
btnConfirmNew?.addEventListener('click', () => {
  modalNewGame?.classList.remove('active');
  resetGameState();
});
btnCancelNew?.addEventListener('click', () => {
  modalNewGame?.classList.remove('active');
  turnTimer.resume();
});

/* Exit / Forfeit modal — pause timer while modal is open */
btnExitGame?.addEventListener('click', () => {
  if (state.mode === 'online' && !state.game.isGameOver) {
    modalExit?.classList.add('active');
    turnTimer.pause();
  } else {
    exitToHome();
  }
}, true /* capture phase — overrides earlier listener */);
btnCancelExit?.addEventListener('click', () => {
  modalExit?.classList.remove('active');
  turnTimer.resume();
}, true);

/* Undo */
btnUndo?.addEventListener('click', () => {
  if (state.game.moveHistory.length === 0 || state.isAiThinking) return;
  const pops = (state.mode === 'ai_easy' || state.mode === 'ai_smart')
    ? Math.min(2, state.game.moveHistory.length) : 1;
  const remaining = state.game.moveHistory.slice(0, state.game.moveHistory.length - pops);

  // Full replay for correctness
  state.game.reset(state.playerCount);
  buildBoard();

  remaining.forEach(mv => {
    const r2 = state.game.makeMove(mv.type, mv.row, mv.col);
    const el = $(`${mv.type}-line-${mv.row}-${mv.col}`);
    if (el) el.classList.add('drawn', `player-${mv.player}`);
    r2.completedBoxes?.forEach(({ row: r, col: c }) => {
      const bx = $(`box-${r}-${c}`);
      if (bx) {
        bx.classList.add('claimed', `player-${mv.player}`);
        const t = bx.querySelector('.box-label');
        if (t) t.textContent = initials(state.players[mv.player]?.username || `P${mv.player}`);
      }
    });
  });

  state.totalMoves = Math.max(0, state.totalMoves - pops);
  clearBanner();
  updateHUD();
  turnTimer.start();
});

function exitToHome() {
  turnTimer.stop();
  clearBanner();
  modalGameover?.classList.remove('active');
  modalExit?.classList.remove('active');
  modalNewGame?.classList.remove('active');
  if (onlineEngine) { onlineEngine.disconnect(); onlineEngine = null; }
  refreshLeaderboard();
  enterHome();
}

/* ═══════════════════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  await auth.init();
  ['dots_boxes_users_json', 'dots_boxes_current_user'].forEach(k => {
    try { localStorage.removeItem(k); } catch {}
  });
  const saved = auth.getCurrentUser();
  if (saved) { state.p1User = saved; enterHome(); }
  else        showScreen(S_AUTH);
});
