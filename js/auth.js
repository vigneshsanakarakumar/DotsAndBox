/**
 * JSON-Based User Profile & Authentication Manager
 * Persists player records, wins/losses, custom avatars, and session data.
 * Enforces unique usernames across all registered players.
 */

const STORAGE_KEY_USERS = 'dots_boxes_users_json';
const STORAGE_KEY_CURRENT_USER = 'dots_boxes_current_user';

export const AVATAR_PRESETS = ['🦊', '⚡', '🐉', '🚀', '👑', '👾', '🎯', '🦁', '🌟', '🦄', '🔥', '🎮'];

export class AuthManager {
  constructor() {
    this.users = this.loadUsersFromStorage();
    this.currentUser = this.loadCurrentUser();
  }

  loadUsersFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_USERS);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  saveUsersToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(this.users, null, 2));
    } catch (e) {}
  }

  loadCurrentUser() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
      if (!data) return null;
      const saved = JSON.parse(data);
      // Re-validate the saved user still exists
      if (saved && this.users[saved.id]) return this.users[saved.id];
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Returns true if username is already taken by ANOTHER user (case-insensitive).
   * @param {string} username
   * @param {string|null} excludeId - id to exclude from the check (for the current user editing their own name)
   */
  isUsernameTaken(username, excludeId = null) {
    const id = username.trim().toLowerCase();
    if (excludeId && id === excludeId) return false;
    return !!this.users[id];
  }

  /**
   * Registers a brand-new player. Fails if username is already taken.
   * @returns {{ success: boolean, user?: object, error?: string }}
   */
  register(username, avatar = '⚡') {
    const cleanName = (username || '').trim().slice(0, 16);
    if (!cleanName || cleanName.length < 2) {
      return { success: false, error: 'Username must be at least 2 characters.' };
    }
    const id = cleanName.toLowerCase();
    if (this.users[id]) {
      return { success: false, error: `"${cleanName}" is already taken. Choose another name.` };
    }

    const user = {
      id,
      username: cleanName,
      avatar: avatar || '⚡',
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      createdAt: new Date().toISOString()
    };
    this.users[id] = user;
    this.currentUser = user;
    this.saveUsersToStorage();
    try { localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user)); } catch (e) {}
    return { success: true, user };
  }

  /**
   * Signs in an existing player by exact username.
   * @returns {{ success: boolean, user?: object, error?: string }}
   */
  login(username) {
    const id = (username || '').trim().toLowerCase();
    if (!this.users[id]) {
      return { success: false, error: `No player named "${username}" found. Please register first.` };
    }
    this.currentUser = this.users[id];
    try { localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(this.currentUser)); } catch (e) {}
    return { success: true, user: this.currentUser };
  }

  /** Updates avatar for the current user. */
  updateAvatar(avatar) {
    if (!this.currentUser) return;
    this.currentUser.avatar = avatar;
    this.users[this.currentUser.id].avatar = avatar;
    this.saveUsersToStorage();
    try { localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(this.currentUser)); } catch (e) {}
  }

  logout() {
    this.currentUser = null;
    try { localStorage.removeItem(STORAGE_KEY_CURRENT_USER); } catch (e) {}
  }

  recordMatch(userId, result) {
    if (!userId || !this.users[userId]) return;
    this.users[userId].gamesPlayed++;
    if (result === 'win') this.users[userId].wins++;
    else if (result === 'loss') this.users[userId].losses++;
    else if (result === 'draw') this.users[userId].draws++;
    this.saveUsersToStorage();
    if (this.currentUser && this.currentUser.id === userId) {
      this.currentUser = { ...this.users[userId] };
      try { localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(this.currentUser)); } catch (e) {}
    }
  }

  getCurrentUser() { return this.currentUser; }
  getAllUsers() { return Object.values(this.users); }
}

export const auth = new AuthManager();
