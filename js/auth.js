/**
 * Firebase Auth Manager — Google Sign-In + Email/Password
 * Falls back to localStorage-only mode if Firebase is not yet configured.
 *
 * Key rules enforced:
 *  • Username must be unique across ALL registered accounts (case-insensitive).
 *  • If Google login produces a display name already taken, player is forced to pick another.
 *  • Clearing all users = clearing localStorage DB (admin function).
 */

import { firebaseConfig, FIREBASE_CONFIGURED } from './firebase-config.js';

/* ─── localStorage keys ─────────────────────────────────────────────── */
const KEY_USERS   = 'dab_users_v2';      // { [username_lower]: ProfileObject }
const KEY_SESSION = 'dab_session_v2';    // currently logged-in profile

/* ─── Helpers ────────────────────────────────────────────────────────── */
function loadUsers() {
  try { return JSON.parse(localStorage.getItem(KEY_USERS) || '{}'); } catch { return {}; }
}
function saveUsers(db) {
  try { localStorage.setItem(KEY_USERS, JSON.stringify(db)); } catch {}
}
function loadSession() {
  try { const d = localStorage.getItem(KEY_SESSION); return d ? JSON.parse(d) : null; } catch { return null; }
}
function saveSession(user) {
  try { localStorage.setItem(KEY_SESSION, user ? JSON.stringify(user) : 'null'); } catch {}
}

/* ─── ProfileObject schema ───────────────────────────────────────────── */
function makeProfile(uid, username, email, photoURL) {
  return {
    uid,
    username,           // display name (unique)
    usernameLower: username.toLowerCase(),
    email:  email  || '',
    photo:  photoURL || '',
    wins:   0,
    losses: 0,
    draws:  0,
    gamesPlayed: 0,
    createdAt: new Date().toISOString(),
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   AuthManager
   ═══════════════════════════════════════════════════════════════════════ */
class AuthManager extends EventTarget {
  constructor() {
    super();
    this.firebaseApp  = null;
    this.firebaseAuth = null;
    this.currentUser  = loadSession();   // fast restore from last session
    this._ready       = false;
    this._fbInitPromise = null;
  }

  /* ─── Firebase init (lazy) ──────────────────────────────────────────── */
  async _initFirebase() {
    if (this._fbInitPromise) return this._fbInitPromise;
    if (!FIREBASE_CONFIGURED) return null;

    this._fbInitPromise = (async () => {
      try {
        const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
        const { getAuth, signInWithPopup, signInWithEmailAndPassword,
                createUserWithEmailAndPassword, GoogleAuthProvider,
                signOut, onAuthStateChanged }
          = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');

        // Avoid double-init if module is hot-reloaded
        this.firebaseApp  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
        this.firebaseAuth = getAuth(this.firebaseApp);

        // Initialize Analytics (non-blocking, optional)
        try {
          const { getAnalytics } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js');
          getAnalytics(this.firebaseApp);
        } catch (e) { /* analytics not critical */ }

        // Expose sign helpers
        this._signInGoogle = () => signInWithPopup(this.firebaseAuth, new GoogleAuthProvider());
        this._signInEmail  = (e, p) => signInWithEmailAndPassword(this.firebaseAuth, e, p);
        this._signUpEmail  = (e, p) => createUserWithEmailAndPassword(this.firebaseAuth, e, p);
        this._signOut      = () => signOut(this.firebaseAuth);

        // onAuthStateChanged fires on load — if Firebase already has a session,
        // auto-restore the user profile without requiring a new login.
        return new Promise(resolve => {
          onAuthStateChanged(this.firebaseAuth, fbUser => {
            if (!this._ready) {
              this._ready = true;
              if (fbUser) {
                // Try to restore stored profile for this UID
                const existing = this.getProfileByUid(fbUser.uid);
                if (existing && !this.currentUser) {
                  this.currentUser = existing;
                  saveSession(existing);
                }
              }
              resolve(fbUser);
            }
          });
        });
      } catch (err) {
        console.error('Firebase init failed:', err);
        return null;
      }
    })();

    return this._fbInitPromise;
  }

  /* ─── Public: init (call once at startup) ────────────────────────────── */
  async init() {
    await this._initFirebase();
    return this;
  }

  /* ─── Username uniqueness check ────────────────────────────────────── */
  isUsernameTaken(username, excludeUid = null) {
    const db   = loadUsers();
    const key  = username.trim().toLowerCase();
    const entry = db[key];
    if (!entry) return false;
    if (excludeUid && entry.uid === excludeUid) return false;
    return true;
  }

  /* ─── Register a local profile after Firebase auth ─────────────────── */
  _registerProfile(uid, username, email, photoURL) {
    const db  = loadUsers();
    const key = username.trim().toLowerCase();
    if (db[key] && db[key].uid !== uid) {
      return { success: false, error: `"${username}" is already taken.` };
    }
    const profile = db[key] && db[key].uid === uid
      ? db[key]                                    // returning user
      : makeProfile(uid, username.trim(), email, photoURL);

    db[key] = profile;
    saveUsers(db);
    this.currentUser = profile;
    saveSession(profile);
    return { success: true, user: profile };
  }

  /* ─── Google Sign-In ─────────────────────────────────────────────────── */
  async signInWithGoogle() {
    await this._initFirebase();
    if (!this._signInGoogle) throw new Error('Firebase not configured.');
    const cred = await this._signInGoogle();
    const fb   = cred.user;
    return { uid: fb.uid, email: fb.email, displayName: fb.displayName, photo: fb.photoURL };
  }

  /* ─── Email/Password sign-up ─────────────────────────────────────────── */
  async signUpWithEmail(email, password) {
    await this._initFirebase();
    if (!this._signUpEmail) {
      // No Firebase — simulate with local account
      return this._localSignUp(email, password);
    }
    try {
      const cred = await this._signUpEmail(email, password);
      return { uid: cred.user.uid, email: cred.user.email, displayName: null, photo: null };
    } catch (err) {
      throw new Error(this._fbErrMsg(err));
    }
  }

  /* ─── Email/Password sign-in ─────────────────────────────────────────── */
  async signInWithEmail(email, password) {
    await this._initFirebase();
    if (!this._signInEmail) {
      return this._localSignIn(email, password);
    }
    try {
      const cred = await this._signInEmail(email, password);
      return { uid: cred.user.uid, email: cred.user.email, displayName: null, photo: null };
    } catch (err) {
      throw new Error(this._fbErrMsg(err));
    }
  }

  /* ─── Local fallback (no Firebase) ─────────────────────────────────── */
  _localSignUp(email, password) {
    const db  = loadUsers();
    const uid = 'local_' + btoa(email).replace(/=/g,'');
    const existing = Object.values(db).find(u => u.email === email);
    if (existing) throw new Error('Email already registered. Sign in instead.');
    return { uid, email, displayName: null, photo: null };
  }

  _localSignIn(email, password) {
    const db = loadUsers();
    const user = Object.values(db).find(u => u.email === email);
    if (!user) throw new Error('No account found with this email.');
    return { uid: user.uid, email: user.email, displayName: user.username, photo: user.photo };
  }

  /* ─── Final step: set username after auth ───────────────────────────── */
  setUsername(uid, username, email, photoURL) {
    if (!username || username.trim().length < 2) {
      return { success: false, error: 'Username must be at least 2 characters.' };
    }
    return this._registerProfile(uid, username.trim(), email, photoURL);
  }

  /* ─── Retrieve profile by UID ────────────────────────────────────────── */
  getProfileByUid(uid) {
    const db = loadUsers();
    return Object.values(db).find(u => u.uid === uid) || null;
  }

  /* ─── Session ────────────────────────────────────────────────────────── */
  getCurrentUser() { return this.currentUser; }

  logout() {
    this.currentUser = null;
    saveSession(null);
    if (this._signOut) this._signOut().catch(() => {});
  }

  /* ─── Stats ──────────────────────────────────────────────────────────── */
  recordMatch(uid, result) {
    const db = loadUsers();
    const user = Object.values(db).find(u => u.uid === uid);
    if (!user) return;
    user.gamesPlayed++;
    if (result === 'win') user.wins++;
    else if (result === 'loss') user.losses++;
    else if (result === 'draw') user.draws++;
    db[user.usernameLower] = user;
    saveUsers(db);
    if (this.currentUser && this.currentUser.uid === uid) {
      this.currentUser = { ...user };
      saveSession(this.currentUser);
    }
  }

  /* ─── Admin: clear ALL users from localStorage ───────────────────────── */
  clearAllUsers() {
    try { localStorage.removeItem(KEY_USERS); } catch {}
    try { localStorage.removeItem(KEY_SESSION); } catch {}
    this.currentUser = null;
  }

  getAllUsers() {
    return Object.values(loadUsers()).sort((a,b) => b.wins - a.wins);
  }

  /* ─── Error message normaliser for Firebase errors ──────────────────── */
  _fbErrMsg(err) {
    const map = {
      'auth/user-not-found':      'No account found with this email.',
      'auth/wrong-password':      'Incorrect password.',
      'auth/email-already-in-use':'Email already registered. Sign in instead.',
      'auth/weak-password':       'Password must be at least 6 characters.',
      'auth/invalid-email':       'Invalid email address.',
      'auth/too-many-requests':   'Too many attempts. Try again later.',
      'auth/popup-closed-by-user':'Sign-in was cancelled.',
      'auth/network-request-failed': 'Network error. Check your connection.',
    };
    return map[err.code] || err.message || 'Authentication failed.';
  }
}

export const auth = new AuthManager();
