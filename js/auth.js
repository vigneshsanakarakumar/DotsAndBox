/**
 * JSON-Based User Profile & Authentication Manager
 * Persists player records, wins/losses, custom avatars, and session data.
 */

const STORAGE_KEY_USERS = 'dots_boxes_users_json';
const STORAGE_KEY_CURRENT_USER = 'dots_boxes_current_user';

export const AVATAR_PRESETS = ['🦊', '⚡', '🐉', '🚀', '👑', '👾', '🎯', '🦁', '🌟', '🦄'];

export class AuthManager {
  constructor() {
    this.users = this.loadUsersFromStorage();
    this.currentUser = this.loadCurrentUser();
  }

  /**
   * Loads users database from JSON storage
   */
  loadUsersFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_USERS);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.warn('Storage access failed, using memory state');
      return {};
    }
  }

  /**
   * Saves users database back to JSON storage
   */
  saveUsersToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(this.users, null, 2));
    } catch (e) {
      console.warn('Failed to save to storage', e);
    }
  }

  /**
   * Loads currently active user
   */
  loadCurrentUser() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Signs in or registers a user with the given username and avatar
   */
  login(username, avatar = '⚡') {
    const cleanName = (username || 'Player').trim().slice(0, 16);
    const id = cleanName.toLowerCase();

    if (!this.users[id]) {
      // Create new user profile in JSON
      this.users[id] = {
        id,
        username: cleanName,
        avatar: avatar || '⚡',
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        createdAt: new Date().toISOString()
      };
    } else {
      // Update avatar if provided
      if (avatar) this.users[id].avatar = avatar;
    }

    this.currentUser = this.users[id];
    this.saveUsersToStorage();
    try {
      localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(this.currentUser));
    } catch (e) {}

    return this.currentUser;
  }

  /**
   * Logs out current user session
   */
  logout() {
    this.currentUser = null;
    try {
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    } catch (e) {}
  }

  /**
   * Updates stats when a game completes
   */
  recordMatch(result) {
    if (!this.currentUser) return;

    const id = this.currentUser.id;
    if (!this.users[id]) return;

    this.users[id].gamesPlayed++;
    if (result === 'win') {
      this.users[id].wins++;
    } else if (result === 'loss') {
      this.users[id].losses++;
    } else if (result === 'draw') {
      this.users[id].draws++;
    }

    this.currentUser = { ...this.users[id] };
    this.saveUsersToStorage();
    try {
      localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(this.currentUser));
    } catch (e) {}
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getAllUsers() {
    return Object.values(this.users);
  }
}

export const auth = new AuthManager();
